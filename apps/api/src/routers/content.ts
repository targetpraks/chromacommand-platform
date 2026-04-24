import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { ContentAsset, SyncTransformCommand } from "@chromacommand/shared";

export const contentRouter = router({
  createAsset: publicProcedure
    .input(ContentAsset)
    .mutation(async ({ input }) => {
      const assetId = input.assetId || `asset_${Date.now()}`;
      return { assetId, status: "created" };
    }),

  listAssets: publicProcedure
    .input(z.object({ orgId: z.string().optional() }))
    .query(async () => {
      return [];
    }),
});

export const syncRouter = router({
  transform: publicProcedure
    .input(SyncTransformCommand)
    .mutation(async ({ input }) => {
      const commandId = `sync_${Date.now()}`;
      return {
        commandId,
        status: "dispatched",
        components: input.components,
        estimatedCompleteAt: new Date(Date.now() + input.fadeDurationMs).toISOString(),
      };
    }),
});

export const audioRouter = router({
  set: publicProcedure
    .input(
      z.object({
        scope: z.enum(["store", "region", "global"]),
        targetId: z.string(),
        zone: z.enum(["dining", "pickup", "exterior", "back-of-house"]),
        playlistId: z.string(),
        action: z.enum(["play", "pause", "stop", "skip", "duck"]),
        volume: z.number().min(0).max(1).optional(),
        fadeMs: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return {
        commandId: `audio_${Date.now()}`,
        status: "dispatched",
        mqttTopic: `chromacommand/store/${input.targetId}/audio/set/${input.zone}`,
      };
    }),

  announce: publicProcedure
    .input(
      z.object({
        scope: z.enum(["store", "region", "global"]),
        targetId: z.string(),
        zones: z.array(z.enum(["dining", "pickup", "exterior", "back-of-house"])),
        text: z.string(),
        voice: z.string().default("en-ZA-female-1"),
        volume: z.number().min(0).max(1).default(0.7),
        duckMusic: z.boolean().default(true),
        priority: z.number().default(100),
      })
    )
    .mutation(async ({ input }) => {
      return {
        commandId: `announce_${Date.now()}`,
        status: "dispatched",
        mqttTopic: `chromacommand/store/${input.targetId}/audio/announce`,
      };
    }),
});

export const storesRouter = router({
  list: publicProcedure
    .input(z.object({ regionId: z.string().optional() }))
    .query(async () => {
      return [
        { id: "pp-a01", name: "PP-A01 Cape Town CBD", region: "cape-town", status: "active" },
      ];
    }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async () => {
      return { id: "pp-a01", name: "PP-A01 Cape Town CBD", region: "cape-town", status: "active" };
    }),
});
