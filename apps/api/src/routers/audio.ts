import { router, protectedProcedure, requireScope } from "../trpc";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { audioZones, audioPlaylists, activityLog } from "@chromacommand/database/schema";
import { eq, desc } from "drizzle-orm";
import { publishCommand } from "../mqtt";
import { broadcast } from "../live";
import { scopeFromRequest } from "../scope";

const setInput = z.object({
  scope: z.enum(["store", "region", "global"]),
  targetId: z.string(),
  zone: z.enum(["dining", "pickup", "exterior", "back-of-house"]),
  playlistId: z.string().optional(),
  action: z.enum(["play", "pause", "stop", "skip", "duck"]),
  volume: z.number().min(0).max(1).optional(),
  fadeMs: z.number().min(0).optional(),
});

const announceInput = z.object({
  scope: z.enum(["store", "region", "global"]),
  targetId: z.string(),
  zones: z.array(z.enum(["dining", "pickup", "exterior", "back-of-house"])),
  text: z.string(),
  voice: z.string().default("en-ZA-female-1"),
  volume: z.number().min(0).max(1).default(0.7),
  duckMusic: z.boolean().default(true),
  priority: z.number().default(100),
});

export const audioRouter = router({
  getZoneState: protectedProcedure
    .input(z.object({ storeId: z.string() }))
    .query(async ({ input }) => {
      const rows = await db.select().from(audioZones).where(eq(audioZones.storeId, input.storeId));
      return rows.map((r) => ({
        id: r.id,
        zoneType: r.zoneType,
        sinkName: r.sinkName,
        volume: r.volume,
        status: r.status,
      }));
    }),

  set: requireScope<z.infer<typeof setInput>>((i) => scopeFromRequest(i))
    .input(setInput)
    .mutation(async ({ input, ctx }) => {
      await db
        .update(audioZones)
        .set({
          status: input.action === "stop" ? "offline" : "online",
          volume: input.volume ?? undefined,
          lastHeartbeat: new Date(),
        })
        .where(eq(audioZones.storeId, input.targetId));

      await db.insert(activityLog).values({
        userId: (ctx.user as any)?.id ?? null,
        action: "audio_set",
        scope: input.scope,
        targetId: input.targetId,
        details: { zone: input.zone, action: input.action, volume: input.volume },
      });

      const commandId = `audio_${Date.now()}`;
      const topic = `chromacommand/store/${input.targetId}/audio/set/${input.zone}`;
      await publishCommand(
        topic,
        {
          command_id: commandId,
          action: input.action,
          playlist_id: input.playlistId,
          volume: input.volume,
          fade_ms: input.fadeMs,
          ts: Date.now(),
        },
        1
      );

      broadcast({
        type: "audio_update",
        storeId: input.targetId,
        payload: { zone: input.zone, action: input.action, volume: input.volume },
      });

      return { commandId, status: "dispatched", mqttTopic: topic };
    }),

  announce: requireScope<z.infer<typeof announceInput>>((i) => scopeFromRequest(i))
    .input(announceInput)
    .mutation(async ({ input, ctx }) => {
      const commandId = `announce_${Date.now()}`;
      const topic = `chromacommand/store/${input.targetId}/audio/announce`;
      await publishCommand(
        topic,
        {
          command_id: commandId,
          text: input.text,
          voice: input.voice,
          zones: input.zones,
          volume: input.volume,
          duck_music: input.duckMusic,
          priority: input.priority,
          ts: Date.now(),
        },
        1
      );

      await db.insert(activityLog).values({
        userId: (ctx.user as any)?.id ?? null,
        action: "audio_announce",
        scope: input.scope,
        targetId: input.targetId,
        details: { text: input.text, zones: input.zones, duckMusic: input.duckMusic },
      });

      return { commandId, status: "dispatched", mqttTopic: topic };
    }),

  getPlaylistLibrary: protectedProcedure.query(async () => {
    const rows = await db.select().from(audioPlaylists).orderBy(desc(audioPlaylists.createdAt));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      tracks: r.tracks as any[],
      tags: r.tags as string[],
    }));
  }),
});
