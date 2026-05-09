import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@chromacommand/database";
import { users, refreshTokens } from "@chromacommand/database/schema";
import {
  router,
  publicProcedure,
  protectedProcedure,
} from "../trpc";
import {
  loginWithEmail,
  signToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_TTL_SECONDS,
  type AuthUser,
} from "../auth";
import { consume } from "../rate-limit";

const LOGIN_WINDOW_MS = 60_000;
// Failed-login budget per (ip, window) and per (email, window). 30 is a
// reasonable trade between brute-force protection and test/dev ergonomics
// — successful logins do not consume the budget (see below).
const LOGIN_MAX_PER_WINDOW = Number(process.env.LOGIN_MAX_PER_WINDOW || 30);

/**
 * Issue a fresh access + refresh token pair for `user`.
 * Records the refresh token's jti server-side so we can revoke it.
 */
async function mintTokenPair(
  user: AuthUser,
  ip: string | undefined,
  userAgent: string | undefined,
  replacedByPrev?: string
) {
  const jti = randomUUID();
  const accessToken = signToken(user);
  const refreshToken = signRefreshToken(user.id, jti);

  await db.insert(refreshTokens).values({
    jti,
    userId: user.id,
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    ipAddress: ip ?? null,
    userAgent: userAgent ?? null,
  });

  if (replacedByPrev) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedByJti: jti })
      .where(eq(refreshTokens.jti, replacedByPrev));
  }

  return { token: accessToken, refreshToken };
}

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const ip =
        (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        ctx.req.ip ||
        "unknown";
      const ua = (ctx.req.headers["user-agent"] as string) || undefined;

      // Rate-limit by (ip, window) and (email, window). Counts FAILED
      // attempts only — successful logins don't burn quota. Set
      // DISABLE_LOGIN_RATE_LIMIT=1 in test/dev environments to skip.
      const skip = process.env.DISABLE_LOGIN_RATE_LIMIT === "1";
      const ipKey = `login:ip:${ip}`;
      const emailKey = `login:email:${input.email.toLowerCase()}`;
      const { peek } = await import("../rate-limit");
      if (!skip) {
        const ipPeek = peek(ipKey, LOGIN_MAX_PER_WINDOW);
        const emailPeek = peek(emailKey, LOGIN_MAX_PER_WINDOW);
        if (!ipPeek.allowed || !emailPeek.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Too many failed login attempts. Try again in ${Math.ceil(
              Math.max(ipPeek.resetIn, emailPeek.resetIn) / 1000
            )}s.`,
          });
        }
      }

      const user = await loginWithEmail(input.email, input.password);
      if (!user) {
        if (!skip) {
          consume(ipKey, { windowMs: LOGIN_WINDOW_MS, max: LOGIN_MAX_PER_WINDOW });
          consume(emailKey, { windowMs: LOGIN_WINDOW_MS, max: LOGIN_MAX_PER_WINDOW });
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }
      const tokens = await mintTokenPair(user, ip, ua);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          orgId: user.orgId,
          scope: user.scope,
        },
      };
    }),

  /**
   * Refresh-token rotation. The presented refresh token is single-use:
   *   - if valid + not revoked → issue a new pair, mark old jti as replaced
   *   - if jti is already revoked → SECURITY: someone is reusing a token,
   *     revoke the entire chain (current + any descendants) and force re-login
   */
  refresh: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const decoded = verifyRefreshToken(input.refreshToken);
      if (!decoded) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid refresh token" });
      }

      const [row] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.jti, decoded.jti));

      if (!row) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Unknown refresh token" });
      }

      if (row.revokedAt !== null) {
        // Reuse detection: revoke every still-active token for this user.
        await db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Refresh token reuse detected — all sessions revoked",
        });
      }

      if (row.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Refresh token expired" });
      }

      const [u] = await db.select().from(users).where(eq(users.id, row.userId));
      if (!u) throw new TRPCError({ code: "UNAUTHORIZED", message: "User no longer exists" });

      const ip =
        (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        ctx.req.ip ||
        undefined;
      const ua = (ctx.req.headers["user-agent"] as string) || undefined;

      const authUser: AuthUser = {
        id: u.id,
        email: u.email,
        role: u.role as AuthUser["role"],
        orgId: u.orgId ?? null,
        scope: Array.isArray(u.scope) ? (u.scope as string[]) : [],
      };
      const tokens = await mintTokenPair(authUser, ip, ua, decoded.jti);
      return tokens;
    }),

  logout: protectedProcedure
    .input(z.object({ refreshToken: z.string().optional() }))
    .mutation(async ({ input }) => {
      if (!input.refreshToken) return { ok: true };
      const decoded = verifyRefreshToken(input.refreshToken);
      if (!decoded) return { ok: true };
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.jti, decoded.jti));
      return { ok: true };
    }),

  /** Logout from every device — revokes all refresh tokens for the user. */
  logoutAll: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, ctx.user!.id), isNull(refreshTokens.revokedAt)));
    return { ok: true };
  }),

  me: protectedProcedure.query(({ ctx }) => ctx.user),
});
