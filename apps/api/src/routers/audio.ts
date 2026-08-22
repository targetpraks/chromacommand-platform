import { router, protectedProcedure, requireScope, requireRole } from "../trpc";
import { scopeFromRequest } from "../scope";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { audioZones, audioPlaylists, activityLog } from "@chromacommand/database/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { broadcast } from "../live";
import { dispatchToStores } from "../dispatch";

export const AUDIO_ZONES = ["dining", "pickup", "exterior", "back-of-house"] as const;
export const AUDIO_ACTIONS = ["play", "pause", "stop", "skip", "previous", "duck", "unduck", "volume", "mute", "unmute"] as const;
export const AUDIO_SOURCES = ["local", "spotify", "stream"] as const;

const setInput = z.object({
  scope: z.enum(["global", "country", "province", "region", "city", "store"]),
  targetId: z.string(),
  zone: z.enum(AUDIO_ZONES),
  action: z.enum(AUDIO_ACTIONS),
  playlistId: z.string().optional(),
  source: z.enum(AUDIO_SOURCES).optional(),
  streamUrl: z.string().url().optional(),
  volume: z.number().min(0).max(1).optional(),
  fadeMs: z.number().min(0).max(30000).optional(),
});

const announceInput = z.object({
  scope: z.enum(["global", "country", "province", "region", "city", "store"]),
  targetId: z.string(),
  zones: z.array(z.enum(AUDIO_ZONES)).min(1),
  text: z.string().min(1).max(1000),
  voice: z.string().default("en-ZA-female-1"),
  volume: z.number().min(0).max(1).default(0.7),
  duckMusic: z.boolean().default(true),
  priority: z.number().min(1).max(10).default(5),
});

async function syncZoneState(storeIds: string[], zone: string, set: { status?: string; volume?: number }) {
  for (const storeId of storeIds) {
    await db
      .update(audioZones)
      .set({ ...set, lastHeartbeat: new Date() })
      .where(eq(audioZones.id, `${storeId}-${zone}`));
  }
}

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

  multiGetZoneState: protectedProcedure
    .input(z.object({ storeIds: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.storeIds.length === 0) return {};
      const rows = await db.select().from(audioZones).where(inArray(audioZones.storeId, input.storeIds));
      return Object.fromEntries(
        input.storeIds.map((id) => [
          id,
          rows.filter((r) => r.storeId === id).map((r) => ({
            id: r.id,
            zoneType: r.zoneType,
            sinkName: r.sinkName,
            volume: r.volume,
            status: r.status,
          })),
        ])
      );
    }),

  set: requireScope<z.infer<typeof setInput>>((i) => scopeFromRequest(i))
    .input(setInput)
    .mutation(async ({ input, ctx }) => {
      const statusByAction: Partial<Record<typeof input.action, string>> = {
        play: "online",
        pause: "paused",
        stop: "stopped",
      };
      const stateSet: { status?: string; volume?: number } = {
        ...(statusByAction[input.action] ? { status: statusByAction[input.action] } : {}),
        ...(input.volume !== undefined ? { volume: input.volume } : {}),
      };

      const { commandId, storeIds } = await dispatchToStores({
        kind: "audio.set",
        scope: input.scope,
        targetId: input.targetId,
        payload: {
          action: input.action,
          zone: input.zone,
          playlist_id: input.playlistId,
          source: input.source,
          stream_url: input.streamUrl,
          volume: input.volume,
          fade_ms: input.fadeMs,
        },
        build: (storeId) => ({
          topic: `chromacommand/store/${storeId}/audio/set/${input.zone}`,
          body: {},
        }),
        userId: ctx.user?.id,
      });

      if (Object.keys(stateSet).length > 0) {
        await syncZoneState(storeIds, input.zone, stateSet);
      }

      await db.insert(activityLog).values({
        userId: ctx.user?.id ?? null,
        action: "audio_set",
        scope: input.scope,
        targetId: input.targetId,
        details: { zone: input.zone, action: input.action, volume: input.volume, stores: storeIds.length, commandId },
      });

      for (const storeId of storeIds) {
        broadcast({
          type: "audio_update",
          storeId,
          payload: { zone: input.zone, action: input.action, volume: input.volume, commandId },
        });
      }

      return { commandId, status: "dispatched", targets: storeIds.length };
    }),

  announce: requireScope<z.infer<typeof announceInput>>((i) => scopeFromRequest(i))
    .input(announceInput)
    .mutation(async ({ input, ctx }) => {
      const { commandId, storeIds } = await dispatchToStores({
        kind: "audio.announce",
        scope: input.scope,
        targetId: input.targetId,
        payload: {
          text: input.text,
          voice: input.voice,
          zones: input.zones,
          volume: input.volume,
          duck_music: input.duckMusic,
          priority: input.priority,
        },
        build: (storeId) => ({
          topic: `chromacommand/store/${storeId}/audio/announce`,
          body: {},
        }),
        userId: ctx.user?.id,
      });

      await db.insert(activityLog).values({
        userId: ctx.user?.id ?? null,
        action: "audio_announce",
        scope: input.scope,
        targetId: input.targetId,
        details: { text: input.text, zones: input.zones, duckMusic: input.duckMusic, stores: storeIds.length, commandId },
      });

      return { commandId, status: "dispatched", targets: storeIds.length };
    }),

  listPlaylists: protectedProcedure.query(async () => {
    const rows = await db.select().from(audioPlaylists).orderBy(desc(audioPlaylists.createdAt));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      tracks: (r.tracks as any[]) ?? [],
      tags: (r.tags as string[]) ?? [],
    }));
  }),

  createPlaylist: requireRole("hq_admin", "regional_manager", "technician")
    .input(
      z.object({
        name: z.string().min(1).max(128),
        tracks: z.array(z.object({ title: z.string(), url: z.string().optional(), durationSeconds: z.number().optional() })).min(1),
        tags: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [row] = await db.insert(audioPlaylists).values(input).returning();
      await db.insert(activityLog).values({
        userId: ctx.user?.id ?? null,
        action: "audio_playlist_create",
        scope: "global",
        targetId: row.id,
        details: { name: input.name, trackCount: input.tracks.length },
      });
      return { id: row.id, status: "created" };
    }),

  deletePlaylist: requireRole("hq_admin", "regional_manager", "technician")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.delete(audioPlaylists).where(eq(audioPlaylists.id, input.id));
      return { id: input.id, status: "deleted" };
    }),
});
