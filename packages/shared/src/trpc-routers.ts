import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { RgbSetCommand, SyncTransformCommand } from "./schemas";

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

// ─── RGB Router ───────────────────────────────────────────────────────────
export const rgbRouter = router({
  set: publicProcedure
    .input(RgbSetCommand)
    .mutation(async ({ input }) => {
      const commandId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      return {
        commandId,
        status: "dispatched",
        targets: 1,
        estimatedArrivalMs: 150,
        mqttTopic: `chromacommand/store/${input.targetId}/rgb/set/${input.zone || "all"}`,
      };
    }),

  listPresets: publicProcedure
    .input(z.object({ scope: z.enum(["global", "org"]).default("global") }).optional())
    .query(async () => {
      return [
        { id: "preset_navy_gold", name: "Navy & Gold Native", colours: { all: "#1B2A4A" }, mode: "solid" },
        { id: "preset_mtn_yellow", name: "MTN Yellow", colours: { all: "#FFD100" }, mode: "solid" },
        { id: "preset_fnb_gold", name: "FNB Gold", colours: { all: "#CBA135" }, mode: "pulse" },
      ];
    }),

  getState: publicProcedure
    .input(z.object({ storeId: z.string() }))
    .query(async ({ input }) => {
      return {
        storeId: input.storeId,
        zones: [
          { id: "ceiling", colour: "#1B2A4A", mode: "solid", brightness: 0.85 },
          { id: "window", colour: "#1B2A4A", mode: "solid", brightness: 0.85 },
        ],
      };
    }),
});

// ─── Content Router ─────────────────────────────────────────────────────────
export const contentRouter = router({
  createAsset: publicProcedure
    .input(z.any())
    .mutation(async ({ input }) => {
      return { assetId: `asset_${Date.now()}`, status: "created" };
    }),

  listAssets: publicProcedure
    .query(async () => []),
});

// ─── Sync Router ──────────────────────────────────────────────────────────
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

// ─── Audio Router ───────────────────────────────────────────────────────────
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
    .mutation(async ({ input }) => ({
      commandId: `audio_${Date.now()}`,
      status: "dispatched",
      mqttTopic: `chromacommand/store/${input.targetId}/audio/set/${input.zone}`,
    })),

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
    .mutation(async ({ input }) => ({
      commandId: `announce_${Date.now()}`,
      status: "dispatched",
      mqttTopic: `chromacommand/store/${input.targetId}/audio/announce`,
    })),
});

// ─── Stores Router ──────────────────────────────────────────────────────────
export const storesRouter = router({
  list: publicProcedure
    .query(async () => [
      { id: "pp-a01", name: "PP-A01 Cape Town CBD", regionId: "cape-town", status: "active", zones: [] as any[], screens: 3 },
    ]),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => ({
      id: input.id,
      name: "PP-A01 Cape Town CBD",
      regionId: "cape-town",
      status: "active",
      zones: [],
      screens: [],
      audioZones: [],
    })),
});

// ─── App Router ─────────────────────────────────────────────────────────────
export const appRouter = router({
  rgb: rgbRouter,
  content: contentRouter,
  audio: audioRouter,
  sync: syncRouter,
  stores: storesRouter,
  health: publicProcedure.query(() => ({ status: "ok", version: "1.0.0" })),
});

export type AppRouter = typeof appRouter;
