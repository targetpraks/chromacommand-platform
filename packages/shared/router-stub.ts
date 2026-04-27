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
  recent: publicProcedure.input(z.any()).query(() => [] as any[]),
  rollback: publicProcedure.input(z.any()).mutation(() => ({ commandId: "", rolledBackFrom: "", affectedStores: 0 })),
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
  listActivations: publicProcedure.input(z.any()).query(() => [] as any[]),
  invoice: publicProcedure.input(z.any()).query(() => ({} as any)),
});

const auth = router({
  login: publicProcedure.input(z.any()).mutation(() => ({ token: "", refreshToken: "", user: {} as any })),
  refresh: publicProcedure.input(z.any()).mutation(() => ({ token: "", refreshToken: "" })),
  logout: publicProcedure.input(z.any()).mutation(() => ({ ok: true })),
  logoutAll: publicProcedure.mutation(() => ({ ok: true })),
  me: publicProcedure.query(() => ({} as any)),
});

const telemetry = router({
  getSeries: publicProcedure.input(z.any()).query(() => [] as any[]),
  hourlyAggregate: publicProcedure.input(z.any()).query(() => [] as any[]),
  latest: publicProcedure.input(z.any()).query(() => [] as any[]),
  liveDevices: publicProcedure.input(z.any()).query(() => [] as any[]),
  ingest: publicProcedure.input(z.any()).mutation(() => ({ inserted: 0 })),
});

const schedules = router({
  list: publicProcedure.input(z.any().optional()).query(() => [] as any[]),
  create: publicProcedure.input(z.any()).mutation(() => ({} as any)),
  update: publicProcedure.input(z.any()).mutation(() => ({} as any)),
  remove: publicProcedure.input(z.any()).mutation(() => ({ ok: true })),
  activeJobs: publicProcedure.query(() => [] as any[]),
});

const firmware = router({
  listReleases: publicProcedure.input(z.any().optional()).query(() => [] as any[]),
  createRelease: publicProcedure.input(z.any()).mutation(() => ({} as any)),
  deploy: publicProcedure.input(z.any()).mutation(() => ({ deploymentId: "", commandId: "", totalDevices: 0 })),
  reportResult: publicProcedure.input(z.any()).mutation(() => ({ successCount: 0, failureCount: 0, status: "pending" })),
  listDeployments: publicProcedure.input(z.any().optional()).query(() => [] as any[]),
});

const alerts = router({
  listRules: publicProcedure.query(() => [] as any[]),
  recentEvents: publicProcedure.input(z.any().optional()).query(() => [] as any[]),
  createRule: publicProcedure.input(z.any()).mutation(() => ({} as any)),
  updateRule: publicProcedure.input(z.any()).mutation(() => ({} as any)),
  deleteRule: publicProcedure.input(z.any()).mutation(() => ({ ok: true })),
  evalNow: publicProcedure.mutation(() => ({ ok: true })),
  summary: publicProcedure.input(z.any().optional()).query(() => [] as any[]),
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
  schedules,
  firmware,
  alerts,
  health,
});

export type AppRouter = typeof appRouter;
