import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();
const router = t.router;
const publicProcedure = t.procedure;

// Router stub — only provides TYPE shape for @trpc/react-query inference
// All real implementations are in @chromacommand/api

const health = router({
  ping: publicProcedure.query(() => ({ status: "ok", version: "1.1.0" })),
});

const stores = router({
  list: publicProcedure.query(() => []),
  get: publicProcedure.input(z.object({ id: z.string() })).query(() => ({} as any)),
});

const rgb = router({
  listPresets: publicProcedure.query(() => []),
  getState: publicProcedure.input(z.object({ storeId: z.string() })).query(() => ({ storeId: "", zones: [] })),
  multiGetState: publicProcedure.input(z.object({ storeIds: z.array(z.string()) })).query(() => ({} as Record<string, unknown>)),
  set: publicProcedure.input(z.any()).mutation(() => ({ commandId: "", status: "dispatched" })),
});

const content = router({
  listAssets: publicProcedure.query(() => []),
  createAsset: publicProcedure.input(z.any()).mutation(() => ({ assetId: "", status: "created" })),
  listPlaylists: publicProcedure.query(() => []),
  assignPlaylist: publicProcedure.input(z.any()).mutation(() => ({ status: "assigned" })),
  storeScreens: publicProcedure.input(z.object({ storeId: z.string() })).query(() => []),
});

const sync = router({
  transform: publicProcedure.input(z.any()).mutation(() => ({ commandId: "", status: "dispatched", estimatedCompleteAt: "" })),
});

const audio = router({
  set: publicProcedure.input(z.any()).mutation(() => ({ commandId: "", status: "dispatched" })),
  announce: publicProcedure.input(z.any()).mutation(() => ({ commandId: "", status: "dispatched" })),
  getPlaylistLibrary: publicProcedure.query(() => []),
  getZoneState: publicProcedure.input(z.object({ storeId: z.string() })).query(() => []),
});

const analytics = router({
  getStats: publicProcedure.input(z.any().optional()).query(() => ({})),
  getHourly: publicProcedure.input(z.object({ storeId: z.string(), date: z.string() })).query(() => []),
  getContentPerformance: publicProcedure.input(z.object({ period: z.string().default("today") })).query(() => []),
  getActivityLog: publicProcedure.input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }).optional()).query(() => []),
});

const sponsor = router({
  getCampaignData: publicProcedure.input(z.any().optional()).query(() => ({} as any)),
  getTimeSeries: publicProcedure.input(z.any().optional()).query(() => []),
});

const auth = router({
  login: publicProcedure.input(z.any()).mutation(() => ({ token: "", user: {} as any })),
  me: publicProcedure.query(() => ({} as any)),
});

const telemetry = router({
  getSeries: publicProcedure.input(z.any()).query(() => [] as any[]),
  latest: publicProcedure.input(z.any()).query(() => [] as any[]),
  liveDevices: publicProcedure.input(z.any()).query(() => [] as any[]),
  ingest: publicProcedure.input(z.any()).mutation(() => ({ inserted: 0 })),
});

export const appRouter = router({
  auth,
  stores,
  rgb,
  content,
  audio,
  sync,
  analytics,
  sponsor,
  telemetry,
  health,
});

export type AppRouter = typeof appRouter;
