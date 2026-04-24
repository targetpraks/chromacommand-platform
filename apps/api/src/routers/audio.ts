import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { audioZones, audioPlaylists, activityLog } from "@chromacommand/database/schema";
import { eq, and, desc } from "drizzle-orm";

export const audioRouter = router({
  getZoneState: publicProcedure
    .input(z.object({ storeId: z.string() }))
    .query(async ({ input }) => {
      const rows = await db.select().from(audioZones).where(eq(audioZones.storeId, input.storeId));
      return rows.map(r => ({
        id: r.id,
        zoneType: r.zoneType,
        sinkName: r.sinkName,
        volume: r.volume,
        status: r.status,
      }));
    }),

  set: publicProcedure
    .input(z.object({
      scope: z.enum(["store", "region", "global"]),
      targetId: z.string(),
      zone: z.enum(["dining", "pickup", "exterior", "back-of-house"]),
      playlistId: z.string().optional(),
      action: z.enum(["play", "pause", "stop", "skip", "duck"]),
      volume: z.number().min(0).max(1).optional(),
      fadeMs: z.number().min(0).optional(),
    }))
    .mutation(async ({ input }) => {
      await db.update(audioZones).set({
        status: input.action === "play" ? "online" : input.action === "pause" ? "online" : "offline",
        volume: input.volume ?? undefined,
        lastHeartbeat: new Date(),
      }).where(eq(audioZones.storeId, input.targetId));

      await db.insert(activityLog).values({
        action: "audio_set",
        scope: input.scope,
        targetId: input.targetId,
        details: { zone: input.zone, action: input.action, volume: input.volume },
      });

      return {
        commandId: `audio_${Date.now()}`,
        status: "dispatched",
        mqttTopic: `chromacommand/store/${input.targetId}/audio/set/${input.zone}`,
      };
    }),

  announce: publicProcedure
    .input(z.object({
      scope: z.enum(["store", "region", "global"]),
      targetId: z.string(),
      zones: z.array(z.enum(["dining", "pickup", "exterior", "back-of-house"])),
      text: z.string(),
      voice: z.string().default("en-ZA-female-1"),
      volume: z.number().min(0).max(1).default(0.7),
      duckMusic: z.boolean().default(true),
      priority: z.number().default(100),
    }))
    .mutation(async ({ input }) => {
      await db.insert(activityLog).values({
        action: "audio_announce",
        scope: input.scope,
        targetId: input.targetId,
        details: { text: input.text, zones: input.zones, duckMusic: input.duckMusic },
      });

      return {
        commandId: `announce_${Date.now()}`,
        status: "dispatched",
        mqttTopic: `chromacommand/store/${input.targetId}/audio/announce`,
      };
    }),

  getPlaylistLibrary: publicProcedure
    .query(async () => {
      const rows = await db.select().from(audioPlaylists).orderBy(desc(audioPlaylists.createdAt));
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        tracks: r.tracks as any[],
        tags: r.tags as string[],
      }));
    }),
});

function AudioZoneCondition(targetId: string, zone: string) {
  return eq(audioZones.storeId, targetId);
}
