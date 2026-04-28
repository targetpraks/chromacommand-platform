/**
 * Spotify Web API client + OAuth flow.
 *
 * Auth model: Authorization Code flow. Operator authorises the platform
 * once; we store access + refresh tokens and refresh transparently when
 * an access token is within 5 minutes of expiry.
 *
 * Multi-store playback model:
 *   - scope=global, targetId=all   → ONE account drives all stores via
 *                                     MQTT fan-out. Each store's edge
 *                                     plays the same playlist URI on its
 *                                     local Spotify Connect device.
 *   - scope=store, targetId=pp-a01 → per-store account (each Pi runs
 *                                     librespot logged in to its own
 *                                     Spotify Premium account).
 */

import { db } from "@chromacommand/database";
import { spotifyAccounts, spotifyAuthStates } from "@chromacommand/database/schema";
import { eq, and, lt } from "drizzle-orm";
import { randomBytes } from "node:crypto";

const SPOTIFY_AUTH_BASE = "https://accounts.spotify.com";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

const REQUIRED_SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
  "streaming",
].join(" ");

interface SpotifyTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: "Bearer";
}

interface SpotifyUserProfile {
  id: string;
  display_name: string | null;
  email?: string;
  product?: "free" | "premium" | "open";
}

function clientCreds(): { id: string; secret: string; redirectUri: string } {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || "http://localhost:4000/spotify/callback";
  if (!id || !secret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set");
  }
  return { id, secret, redirectUri };
}

/** Build the Spotify authorize URL the dashboard sends the operator to. */
export async function buildAuthorizeUrl(opts: {
  userId: string;
  scope: string;
  targetId: string;
}): Promise<string> {
  const { id, redirectUri } = clientCreds();
  const state = randomBytes(24).toString("hex");

  await db.insert(spotifyAuthStates).values({
    state,
    userId: opts.userId,
    scope: opts.scope,
    targetId: opts.targetId,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const params = new URLSearchParams({
    client_id: id,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: REQUIRED_SCOPES,
    show_dialog: "true",
  });
  return `${SPOTIFY_AUTH_BASE}/authorize?${params.toString()}`;
}

/** Handle the callback: exchange code → tokens → store account row. */
export async function handleAuthCallback(code: string, state: string): Promise<{
  accountId: string;
  spotifyUserId: string;
  displayName: string | null;
  scope: string;
  targetId: string;
}> {
  const { id, secret, redirectUri } = clientCreds();

  // Look up the state nonce.
  const [stateRow] = await db
    .select()
    .from(spotifyAuthStates)
    .where(eq(spotifyAuthStates.state, state));
  if (!stateRow) throw new Error("Invalid OAuth state — possible CSRF or replay");
  if (stateRow.expiresAt.getTime() < Date.now()) throw new Error("OAuth state expired — restart the flow");

  // Burn the nonce.
  await db.delete(spotifyAuthStates).where(eq(spotifyAuthStates.state, state));

  // Exchange code for tokens.
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const basicAuth = Buffer.from(`${id}:${secret}`).toString("base64");
  const tokenRes = await fetch(`${SPOTIFY_AUTH_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });
  if (!tokenRes.ok) {
    throw new Error(`Spotify token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const tokens = (await tokenRes.json()) as SpotifyTokenResponse;

  // Fetch the user profile so we can store display_name + product tier.
  const profileRes = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) {
    throw new Error(`Spotify /me failed: ${profileRes.status}`);
  }
  const profile = (await profileRes.json()) as SpotifyUserProfile;

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Upsert by (scope, targetId, spotifyUserId) — re-authorising the same
  // account replaces the row rather than creating duplicates.
  const [existing] = await db
    .select()
    .from(spotifyAccounts)
    .where(
      and(
        eq(spotifyAccounts.scope, stateRow.scope),
        eq(spotifyAccounts.targetId, stateRow.targetId),
        eq(spotifyAccounts.spotifyUserId, profile.id)
      )
    );

  let row;
  if (existing) {
    [row] = await db
      .update(spotifyAccounts)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? existing.refreshToken,
        tokenScope: tokens.scope,
        expiresAt,
        productTier: profile.product ?? existing.productTier,
        displayName: profile.display_name ?? existing.displayName,
        active: true,
        updatedAt: new Date(),
      })
      .where(eq(spotifyAccounts.id, existing.id))
      .returning();
  } else {
    [row] = await db
      .insert(spotifyAccounts)
      .values({
        scope: stateRow.scope,
        targetId: stateRow.targetId,
        spotifyUserId: profile.id,
        displayName: profile.display_name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token!,
        tokenScope: tokens.scope,
        expiresAt,
        productTier: profile.product,
        linkedBy: stateRow.userId,
        active: true,
      })
      .returning();
  }

  return {
    accountId: row.id,
    spotifyUserId: row.spotifyUserId,
    displayName: row.displayName,
    scope: row.scope,
    targetId: row.targetId,
  };
}

/**
 * Get a fresh access token for a given (scope, targetId). Falls back to
 * the global account when no scope-specific account is linked.
 *
 * Auto-refreshes when within 5 minutes of expiry.
 */
export async function getAccessToken(scope: string, targetId: string): Promise<{
  accessToken: string;
  account: typeof spotifyAccounts.$inferSelect;
} | null> {
  let [account] = await db
    .select()
    .from(spotifyAccounts)
    .where(
      and(
        eq(spotifyAccounts.scope, scope),
        eq(spotifyAccounts.targetId, targetId),
        eq(spotifyAccounts.active, true)
      )
    );

  // Fall back to the global account if no specific one exists.
  if (!account) {
    [account] = await db
      .select()
      .from(spotifyAccounts)
      .where(
        and(
          eq(spotifyAccounts.scope, "global"),
          eq(spotifyAccounts.targetId, "all"),
          eq(spotifyAccounts.active, true)
        )
      );
  }

  if (!account) return null;

  const refreshThreshold = Date.now() + 5 * 60 * 1000;
  if (account.expiresAt.getTime() <= refreshThreshold) {
    account = await refreshAccessToken(account);
  }

  return { accessToken: account.accessToken, account };
}

async function refreshAccessToken(
  account: typeof spotifyAccounts.$inferSelect
): Promise<typeof spotifyAccounts.$inferSelect> {
  const { id, secret } = clientCreds();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: account.refreshToken,
  });
  const basicAuth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${SPOTIFY_AUTH_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Spotify refresh failed: ${res.status} ${await res.text()}`);
  }
  const tokens = (await res.json()) as SpotifyTokenResponse;
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const [updated] = await db
    .update(spotifyAccounts)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? account.refreshToken,
      expiresAt: newExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(spotifyAccounts.id, account.id))
    .returning();
  return updated;
}

/** Authenticated GET against the Spotify Web API. */
export async function spotifyGet<T = unknown>(scope: string, targetId: string, path: string): Promise<T> {
  const t = await getAccessToken(scope, targetId);
  if (!t) throw new Error(`No Spotify account linked for ${scope}:${targetId}`);
  const res = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${t.accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Spotify GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/** Authenticated PUT against the Spotify Web API (used for play / pause). */
export async function spotifyPut(
  scope: string,
  targetId: string,
  path: string,
  body?: unknown
): Promise<void> {
  const t = await getAccessToken(scope, targetId);
  if (!t) throw new Error(`No Spotify account linked for ${scope}:${targetId}`);
  const res = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${t.accessToken}`,
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  // Spotify returns 204 for play/pause/transfer; some return 202.
  if (res.status >= 400) {
    throw new Error(`Spotify PUT ${path} failed: ${res.status} ${await res.text()}`);
  }
}

/** Cleanup expired auth states once an hour. */
setInterval(async () => {
  try {
    await db.delete(spotifyAuthStates).where(lt(spotifyAuthStates.expiresAt, new Date()));
  } catch { /* db might be unavailable; retry next tick */ }
}, 3600_000).unref?.();
