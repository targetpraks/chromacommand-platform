import { z } from "zod";
import { t, router, publicProcedure } from "./trpc";

// ─── Router Stub ───────────────────────────────────────────────
// This file provides type shape for @trpc/react-query inference.
// ALL business logic (DB queries, MQTT, etc.) lives in the API package.

export const rgbRouter = router({
  listPresets: publicProcedure.query(() => []),
  getState: publicProcedure.input(z.object({ storeId: z.string() })).query(() => ({ storeId: "", zones: [] })),
  multiGetState: publicProcedure.input(z.object({ storeIds: z.array(z.string()) })).query(() => ({} as Record<string, unknown>)),
  set: publicProcedure.input(z.any()).mutation(() => ({ commandId: "", status: "dispatched" })),
});

export const contentRouter = router({
  listAssets: publicProcedure.query(() => []),
  createAsset: publicProcedure.input(z.any()).mutation(() => ({ assetId: "", status: "created" })),
  listPlaylists: publicProcedure.query(() => []),
  assignPlaylist: publicProcedure.input(z.any()).mutation(() => ({ status: "assigned" })),
  storeScreens: publicProcedure.input(z.object({ storeId: z.string() })).query(() => []),
});

export const audioRouter = router({
  set: publicProcedure.input(z.any()).mutation(() => ({ commandId: "", status: "dispatched" })),
  announce: publicProcedure.input(z.any()).mutation(() => ({ commandId: "", status: "dispatched" })),
  getPlaylistLibrary: publicProcedure.query(() => []),
  getZoneState: publicProcedure.input(z.object({ storeId: z.string() })).query(() => []),
});

export const syncRouter = router({
  transform: publicProcedure.input(z.any()).mutation(() => ({ commandId: "", status: "dispatched", estimatedCompleteAt: "" })),
});

export const storesRouter = router({
  list: publicProcedure.input(z.any().optional()).query(() => []),
  get: publicProcedure.input(z.object({ id: z.string() })).query(() => ({} as any)),
  addZone: publicProcedure
    .input(z.object({
      storeId: z.string(),
      id: z.string(),
      displayName: z.string(),
      group: z.string(),
      controllerMac: z.string(),
      ledCount: z.number(),
      position: z.any().optional(),
      dimensions: z.any().optional(),
    }))
    .mutation(() => ({ status: "added" })),
});

export const analyticsRouter = router({
  getStats: publicProcedure
    .input(z.object({ storeId: z.string().optional(), period: z.enum(["today", "week", "month"]).default("today") }).optional())
    .query(() => ({})),
  getHourly: publicProcedure
    .input(z.object({ storeId: z.string(), date: z.string() }))
    .query(() => [] as { hour: number; footfall: number }[]),
  getContentPerformance: publicProcedure
    .input(z.object({ period: z.string().default("today") }))
    .query(() => []),
  getActivityLog: publicProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }).optional())
    .query(() => []),
});

export const appRouter = router({
  stores: storesRouter,
  rgb: rgbRouter,
  content: contentRouter,
  audio: audioRouter,
  sync: syncRouter,
  analytics: analyticsRouter,
  health: router({
    ping: publicProcedure.query(() => ({ status: "ok", version: "1.0.0" })),
  }),
});

export type AppRouter = typeof appRouter;
