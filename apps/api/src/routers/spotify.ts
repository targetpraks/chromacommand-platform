import { z } from "zod";
import { router, protectedProcedure, requireRole, requireScope } from "../trpc";
import { db } from "@chromacommand/database";
import { spotifyAccounts, stores, activityLog } from "@chromacommand/database/schema";
import { eq, desc, and } from "drizzle-orm";
import { spotifyGet, spotifyPut } from "../spotify";
import { publishCommand } from "../mqtt";
import { broadcast } from "../live";
import { scopeFromRequest } from "../scope";

interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  uri: string;
  images?: Array<{ url: string }>;
  tracks?: { total: number };
  owner?: { display_name?: string };
}

interface SpotifyDevice {
  id: string | null;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number | null;
}

export const spotifyRouter = router({
  /** Linked Spotify accounts visible to this user. */
  listAccounts: protectedProcedure.query(async () => {
    const rows = await db
      .select({
        id: spotifyAccounts.id,
        scope: spotifyAccounts.scope,
        targetId: spotifyAccounts.targetId,
        spotifyUserId: spotifyAccounts.spotifyUserId,
        displayName: spotifyAccounts.displayName,
        productTier: spotifyAccounts.productTier,
        active: spotifyAccounts.active,
        expiresAt: spotifyAccounts.expiresAt,
        updatedAt: spotifyAccounts.updatedAt,
      })
      .from(spotifyAccounts)
      .orderBy(desc(spotifyAccounts.updatedAt));
    return rows;
  }),

  /** URL the dashboard should redirect to in order to start the OAuth flow. */
  authorizeUrl: protectedProcedure
    .input(z.object({ scope: z.enum(["global", "region", "store"]).default("global"), targetId: z.string().default("all") }))
    .query(({ input }) => {
      const apiBase = process.env.API_PUBLIC_URL || "http://localhost:4000";
      const params = new URLSearchParams({ scope: input.scope, targetId: input.targetId });
      return { url: `${apiBase}/spotify/auth?${params.toString()}` };
    }),

  /** Disconnect a Spotify account (soft — sets active=false). */
  disconnect: requireRole("hq_admin", "regional_manager")
    .input(z.object({ accountId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.update(spotifyAccounts).set({ active: false, updatedAt: new Date() }).where(eq(spotifyAccounts.id, input.accountId));
      return { ok: true };
    }),

  /** List the operator's Spotify playlists (public + private). */
  listPlaylists: protectedProcedure
    .input(
      z
        .object({
          scope: z.enum(["global", "region", "store"]).default("global"),
          targetId: z.string().default("all"),
          limit: z.number().int().min(1).max(50).default(50),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const i = input ?? { scope: "global" as const, targetId: "all", limit: 50 };
      const data = await spotifyGet<{ items: SpotifyPlaylist[]; total: number }>(
        i.scope,
        i.targetId,
        `/me/playlists?limit=${i.limit}`
      );
      return {
        total: data.total,
        items: data.items.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          uri: p.uri,
          imageUrl: p.images?.[0]?.url ?? null,
          trackCount: p.tracks?.total ?? 0,
          owner: p.owner?.display_name ?? null,
        })),
      };
    }),

  /** Search Spotify for tracks/albums/playlists. */
  search: protectedProcedure
    .input(
      z.object({
        q: z.string().min(1),
        type: z.enum(["track", "album", "playlist", "artist"]).default("playlist"),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const params = new URLSearchParams({
        q: input.q,
        type: input.type,
        limit: String(input.limit),
      });
      const data = await spotifyGet<any>("global", "all", `/search?${params.toString()}`);
      const key = `${input.type}s`;
      return data[key]?.items ?? [];
    }),

  /** Spotify Connect devices the linked account can see. */
  listDevices: protectedProcedure
    .input(
      z
        .object({
          scope: z.enum(["global", "region", "store"]).default("global"),
          targetId: z.string().default("all"),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const i = input ?? { scope: "global" as const, targetId: "all" };
      const data = await spotifyGet<{ devices: SpotifyDevice[] }>(i.scope, i.targetId, "/me/player/devices");
      return data.devices;
    }),

  /** Currently playing track. */
  nowPlaying: protectedProcedure
    .input(
      z
        .object({ scope: z.enum(["global", "region", "store"]).default("global"), targetId: z.string().default("all") })
        .optional()
    )
    .query(async ({ input }) => {
      const i = input ?? { scope: "global" as const, targetId: "all" };
      try {
        const data = await spotifyGet<any>(i.scope, i.targetId, "/me/player/currently-playing");
        return data;
      } catch {
        return null;
      }
    }),

  /**
   * Play a playlist URI to a scope (store/region/all). Two paths:
   *   1) For each affected store, publish MQTT
   *      `chromacommand/store/{id}/audio/spotify/play` — the edge audio
   *      player picks this up and starts the playlist on the local
   *      librespot device using its own per-store Spotify session.
   *   2) ALSO call Spotify Web API directly with the operator's
   *      account so dev demos work even before edge devices are wired
   *      (target the active Connect device on the operator's account).
   */
  playToScope: requireScope<{ scope: "global" | "region" | "store"; targetId: string; playlistUri: string; deviceId?: string; positionMs?: number }>(
    (i) => scopeFromRequest({ scope: i.scope, targetId: i.targetId })
  )
    .input(
      z.object({
        scope: z.enum(["global", "region", "store"]),
        targetId: z.string(),
        playlistUri: z.string().regex(/^spotify:(playlist|album|artist|track):[A-Za-z0-9]+$/),
        deviceId: z.string().optional(),
        positionMs: z.number().int().min(0).default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let affected = await db.select().from(stores);
      if (input.scope === "store") affected = affected.filter((s) => s.id === input.targetId);
      else if (input.scope === "region") affected = affected.filter((s) => s.regionId === input.targetId);

      const commandId = `spot_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const startedAt = Date.now();

      // Path 1: fan out via MQTT so each store's edge can play on its own device.
      for (const s of affected) {
        await publishCommand(
          `chromacommand/store/${s.id}/audio/spotify/play`,
          {
            command_id: commandId,
            playlist_uri: input.playlistUri,
            position_ms: input.positionMs,
            started_at: startedAt,
            ts: Date.now(),
          },
          1
        );
        broadcast({
          type: "audio_update",
          storeId: s.id,
          payload: { source: "spotify", playlistUri: input.playlistUri, action: "play" },
        });
      }

      // Path 2: also call Spotify Web API directly (operator's active device).
      // This is best-effort — fails silently if no active Connect device.
      let directPlaybackOk = false;
      let directPlaybackError: string | undefined;
      try {
        const playPath = input.deviceId
          ? `/me/player/play?device_id=${encodeURIComponent(input.deviceId)}`
          : "/me/player/play";
        const isTrack = input.playlistUri.startsWith("spotify:track:");
        await spotifyPut(input.scope, input.targetId, playPath, {
          ...(isTrack ? { uris: [input.playlistUri] } : { context_uri: input.playlistUri }),
          position_ms: input.positionMs,
        });
        directPlaybackOk = true;
      } catch (err) {
        directPlaybackError = (err as Error).message;
      }

      await db.insert(activityLog).values({
        userId: (ctx.user as any)?.id ?? null,
        action: "spotify_play",
        scope: input.scope,
        targetId: input.targetId,
        details: {
          playlistUri: input.playlistUri,
          affectedStores: affected.length,
          commandId,
          directPlayback: directPlaybackOk,
          directPlaybackError,
        },
      });

      return {
        commandId,
        affectedStores: affected.length,
        directPlayback: { ok: directPlaybackOk, error: directPlaybackError },
      };
    }),

  /** Pause Spotify playback across a scope. */
  pause: requireScope<{ scope: "global" | "region" | "store"; targetId: string }>(
    (i) => scopeFromRequest({ scope: i.scope, targetId: i.targetId })
  )
    .input(
      z.object({
        scope: z.enum(["global", "region", "store"]),
        targetId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let affected = await db.select().from(stores);
      if (input.scope === "store") affected = affected.filter((s) => s.id === input.targetId);
      else if (input.scope === "region") affected = affected.filter((s) => s.regionId === input.targetId);

      const commandId = `spot_pause_${Date.now()}`;
      for (const s of affected) {
        await publishCommand(
          `chromacommand/store/${s.id}/audio/spotify/pause`,
          { command_id: commandId, ts: Date.now() },
          1
        );
      }

      let directOk = false;
      try {
        await spotifyPut(input.scope, input.targetId, "/me/player/pause");
        directOk = true;
      } catch { /* no active device */ }

      await db.insert(activityLog).values({
        userId: (ctx.user as any)?.id ?? null,
        action: "spotify_pause",
        scope: input.scope,
        targetId: input.targetId,
        details: { affectedStores: affected.length, directOk, commandId },
      });

      return { commandId, affectedStores: affected.length, directPlayback: { ok: directOk } };
    }),

  /** Volume control via Spotify Web API. */
  setVolume: requireScope<{ scope: "global" | "region" | "store"; targetId: string; volumePercent: number }>(
    (i) => scopeFromRequest({ scope: i.scope, targetId: i.targetId })
  )
    .input(
      z.object({
        scope: z.enum(["global", "region", "store"]),
        targetId: z.string(),
        volumePercent: z.number().int().min(0).max(100),
      })
    )
    .mutation(async ({ input }) => {
      try {
        await spotifyPut(input.scope, input.targetId, `/me/player/volume?volume_percent=${input.volumePercent}`);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }),
});
