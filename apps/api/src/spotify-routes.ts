import type { FastifyInstance } from "fastify";
import { buildAuthorizeUrl, handleAuthCallback } from "./spotify";
import { userFromRequest } from "./auth";

/**
 * Spotify OAuth needs full-page redirects, so it can't ride tRPC.
 *
 *   GET /spotify/auth?scope=global&targetId=all
 *     → 302 redirect to Spotify's authorize page
 *
 *   GET /spotify/callback?code=...&state=...
 *     → exchange code for tokens, then 302 to dashboard /audio?spotify=ok
 */
export function registerSpotifyRoutes(fastify: FastifyInstance): void {
  const dashboardOrigin = process.env.DASHBOARD_ORIGIN?.split(",")[0] ?? "http://localhost:3000";

  fastify.get("/spotify/auth", async (req, reply) => {
    const user = await userFromRequest(req);
    if (!user) {
      // Browser redirect — bounce to login with a return-to.
      return reply.redirect(`${dashboardOrigin}/login?next=/audio`);
    }
    const q = req.query as Record<string, string>;
    const scope = q.scope || "global";
    const targetId = q.targetId || "all";
    try {
      const url = await buildAuthorizeUrl({ userId: user.id, scope, targetId });
      return reply.redirect(url);
    } catch (err) {
      reply.code(500);
      return { error: (err as Error).message };
    }
  });

  fastify.get("/spotify/callback", async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (q.error) {
      return reply.redirect(`${dashboardOrigin}/audio?spotify=error&reason=${encodeURIComponent(q.error)}`);
    }
    if (!q.code || !q.state) {
      return reply.redirect(`${dashboardOrigin}/audio?spotify=error&reason=missing-code`);
    }
    try {
      const result = await handleAuthCallback(q.code, q.state);
      return reply.redirect(
        `${dashboardOrigin}/audio?spotify=ok&account=${encodeURIComponent(result.spotifyUserId)}`
      );
    } catch (err) {
      return reply.redirect(
        `${dashboardOrigin}/audio?spotify=error&reason=${encodeURIComponent((err as Error).message)}`
      );
    }
  });
}
