import { z } from "zod";
import { router, publicProcedure } from "./trpc";

// ─── Router Stub ───────────────────────────────────────────────
// Type-shape mirror of apps/api/src/routers/_app.ts for @trpc/react-query
// inference in the dashboard. ALL business logic lives in the API package.
// Keep signatures in sync with the real routers (inputs + return shapes).

const anyInput = z.any().optional();

export const authRouter = router({
  login: publicProcedure.input(z.any()).mutation(() => ({ token: "", refreshToken: "", user: {} as any })),
  logout: publicProcedure.input(z.any().optional()).mutation(() => ({ status: "ok" })),
  logoutAll: publicProcedure.input(z.any().optional()).mutation(() => ({ status: "ok" })),
  me: publicProcedure.query(() => null as unknown as { id: string; email: string; role: string; name?: string } | null),
});

export const storesRouter = router({
  list: publicProcedure.input(z.object({ regionId: z.string().optional() }).optional()).query(() => []),
  get: publicProcedure.input(z.object({ id: z.string() })).query(() => ({} as any)),
  create: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  update: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "updated" })),
  remove: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "deleted" })),
  addZone: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  updateZone: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "updated" })),
  removeZone: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "deleted" })),
  addScreen: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  removeScreen: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "deleted" })),
  addAudioZone: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  fleetDevices: publicProcedure.query(() =>
    [] as {
      id: string; storeId: string; storeName: string; deviceType: string;
      label: string; entityRef?: string | null; firmwareVersion?: string | null;
      status: string; lastSeen: string | null;
    }[]
  ),
});

const scopeEnum = z.enum(["global", "country", "province", "region", "city", "store"]);

export const rgbRouter = router({
  listPresets: publicProcedure.query(() => [] as { id: string; name: string; colours: Record<string, string>; mode: string; brightness: number; description?: string | null }[]),
  createPreset: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  deletePreset: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "deleted" })),
  listModes: publicProcedure.query(() => ({ modes: [] as string[] })),
  getState: publicProcedure.input(z.object({ storeId: z.string() })).query(() => ({
    storeId: "",
    zones: [] as { id: string; colour?: string; mode?: string; brightness?: number; group?: string; status?: string; displayName: string; ledCount: number; segments: { name?: string; startIndex: number; endIndex: number }[] }[],
  })),
  multiGetState: publicProcedure.input(z.object({ storeIds: z.array(z.string()) })).query(() => ({} as Record<string, unknown>)),
  set: publicProcedure
    .input(
      z.object({
        scope: scopeEnum,
        targetId: z.string(),
        zone: z.string().optional(),
        colour: z.object({
          mode: z.enum(["solid", "gradient", "pulse", "chase", "breath", "sparkle", "wave", "rainbow"]).default("solid"),
          primary: z.string(),
          secondary: z.string().optional(),
          brightness: z.number().min(0).max(1).default(1),
          speed: z.number().default(1),
        }),
        segments: z.array(z.object({ name: z.string().optional(), startIndex: z.number(), endIndex: z.number(), primary: z.string(), mode: z.string().optional() })).max(16).optional(),
        fadeMs: z.number().min(0).max(30000).default(0),
      })
    )
    .mutation(() => ({ commandId: "", status: "dispatched", targets: 0, estimatedArrivalMs: 0 })),
  blackout: publicProcedure
    .input(z.object({ scope: scopeEnum, targetId: z.string(), fadeMs: z.number().optional() }))
    .mutation(() => ({ commandId: "", targets: 0 })),
  identify: publicProcedure.input(z.object({ zoneId: z.string() })).mutation(() => ({ commandId: "" })),
});

export const contentRouter = router({
  listAssets: publicProcedure.query(() => [] as { id: string; name: string; type: string; durationSeconds?: number; priority?: number; tags?: unknown; updated: string }[]),
  getAsset: publicProcedure.input(z.object({ id: z.string() })).query(() => ({} as any)),
  createAsset: publicProcedure.input(z.any()).mutation(() => ({ assetId: "", status: "created" })),
  deleteAsset: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "deleted" })),
  listPlaylists: publicProcedure.query(() => []),
  savePlaylist: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  assignPlaylist: publicProcedure
    .input(z.object({ playlistId: z.string(), scope: scopeEnum, targetId: z.string(), screenIds: z.array(z.string()).optional(), active: z.boolean().optional() }))
    .mutation(() => ({ commandId: "", status: "assigned", stores: 0 })),
  pushAsset: publicProcedure
    .input(z.object({ scope: scopeEnum, targetId: z.string(), assetId: z.string(), durationSeconds: z.number().optional() }))
    .mutation(() => ({ commandId: "", targets: 0 })),
  emergencyMessage: publicProcedure
    .input(z.object({ scope: scopeEnum, targetId: z.string(), heading: z.string(), body: z.string().optional(), backgroundColor: z.string().optional() }))
    .mutation(() => ({ commandId: "", targets: 0 })),
  clearOverlays: publicProcedure
    .input(z.object({ scope: scopeEnum, targetId: z.string() }))
    .mutation(() => ({ commandId: "", targets: 0 })),
  screenCommand: publicProcedure
    .input(z.object({ screenId: z.string(), command: z.enum(["reload", "set_brightness", "reboot", "screenshot"]), brightness: z.number().optional() }))
    .mutation(() => ({ commandId: "" })),
  storeScreens: publicProcedure.input(z.object({ storeId: z.string() })).query(() => [] as { id: string; screenType: string; hardwareType?: string | null; status: string }[]),
});

export const audioRouter = router({
  getZoneState: publicProcedure.input(z.object({ storeId: z.string() })).query(() => [] as { id: string; zoneType: string; sinkName?: string | null; volume?: number | null; status: string }[]),
  multiGetZoneState: publicProcedure.input(z.object({ storeIds: z.array(z.string()) })).query(() => ({} as Record<string, unknown>)),
  set: publicProcedure
    .input(
      z.object({
        scope: scopeEnum,
        targetId: z.string(),
        zone: z.enum(["dining", "pickup", "exterior", "back-of-house"]),
        action: z.enum(["play", "pause", "stop", "skip", "previous", "duck", "unduck", "volume", "mute", "unmute"]),
        playlistId: z.string().optional(),
        source: z.enum(["local", "spotify", "stream"]).optional(),
        streamUrl: z.string().optional(),
        volume: z.number().min(0).max(1).optional(),
        fadeMs: z.number().optional(),
      })
    )
    .mutation(() => ({ commandId: "", status: "dispatched", targets: 0 })),
  announce: publicProcedure
    .input(
      z.object({
        scope: scopeEnum,
        targetId: z.string(),
        zones: z.array(z.enum(["dining", "pickup", "exterior", "back-of-house"])).min(1),
        text: z.string(),
        voice: z.string().optional(),
        volume: z.number().optional(),
        duckMusic: z.boolean().optional(),
        priority: z.number().optional(),
      })
    )
    .mutation(() => ({ commandId: "", status: "dispatched", targets: 0 })),
  listPlaylists: publicProcedure.query(() => [] as { id: string; name: string; tracks: unknown[]; tags: string[] }[]),
  createPlaylist: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  deletePlaylist: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "deleted" })),
});

export const syncRouter = router({
  transform: publicProcedure
    .input(
      z.object({
        scope: z.enum(["global", "region", "store"]),
        targetId: z.string(),
        presetId: z.string(),
        effectiveAt: z.string(),
        fadeDurationMs: z.number().default(3000),
        components: z.object({ rgb: z.boolean().default(true), content: z.boolean().default(true), audio: z.boolean().default(true) }).optional(),
      })
    )
    .mutation(() => ({ commandId: "", status: "dispatched", affectedStores: 0, estimatedCompleteAt: "" })),
  recent: publicProcedure.input(z.object({ targetId: z.string().optional(), limit: z.number().optional() }).optional()).query(() => []),
  rollback: publicProcedure.input(z.object({ commandId: z.string() })).mutation(() => ({ commandId: "", rolledBackFrom: "", affectedStores: 0 })),
});

export const analyticsRouter = router({
  getStats: publicProcedure.input(anyInput).query(() => ({} as any)),
  getContentPerformance: publicProcedure.input(z.object({ period: z.string().optional() }).optional()).query(() => []),
  getActivityLog: publicProcedure.input(z.object({ limit: z.number().optional(), offset: z.number().optional() }).optional()).query(() => []),
});

export const sponsorRouter = router({
  getCampaignData: publicProcedure
    .input(z.object({ sponsorName: z.string().default("MTN"), storeIds: z.array(z.string()).optional(), period: z.string().optional() }))
    .query(() => ({} as any)),
  getTimeSeries: publicProcedure.input(z.any()).query(() => [] as any[]),
  invoice: publicProcedure.input(z.any()).query(() => ({} as any)),
});

export const telemetryRouter = router({
  ingest: publicProcedure.input(z.any()).mutation(() => ({ inserted: 0 })),
  getSeries: publicProcedure.input(z.any()).query(() => [] as any[]),
  latest: publicProcedure.input(z.any()).query(() => [] as any[]),
  liveDevices: publicProcedure.query(() => [] as any[]),
  hourlyAggregate: publicProcedure.input(z.any()).query(() => [] as any[]),
});

export const schedulesRouter = router({
  list: publicProcedure.input(anyInput).query(() => [] as any[]),
  create: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  update: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "updated" })),
  remove: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "deleted" })),
  activeJobs: publicProcedure.query(() => [] as any[]),
});

export const firmwareRouter = router({
  listReleases: publicProcedure.query(() => [] as any[]),
  createRelease: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  deploy: publicProcedure.input(z.any()).mutation(() => ({ deploymentId: "", totalDevices: 0 })),
  reportResult: publicProcedure.input(z.any()).mutation(() => ({ status: "ok" })),
  listDeployments: publicProcedure.query(() => [] as any[]),
});

export const alertsRouter = router({
  listRules: publicProcedure.query(() => [] as any[]),
  recentEvents: publicProcedure.input(z.object({ limit: z.number().optional(), storeId: z.string().optional() }).optional()).query(() => [] as any[]),
  summary: publicProcedure.input(z.object({ hours: z.number().optional() }).optional()).query(() => ({} as any)),
  createRule: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  updateRule: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "updated" })),
  deleteRule: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "deleted" })),
  evalNow: publicProcedure.mutation(() => ({ fired: 0, resolved: 0 })),
});

export const spotifyRouter = router({
  authorizeUrl: publicProcedure.input(z.object({ scope: z.string(), targetId: z.string() })).query(() => ({ url: "" })),
  listAccounts: publicProcedure.query(() => [] as any[]),
  listPlaylists: publicProcedure.input(z.any()).query(() => null as unknown as { total?: number; items?: any[] }),
  search: publicProcedure.input(z.any()).query(() => [] as any[]),
  listDevices: publicProcedure.input(z.any()).query(() => [] as any[]),
  nowPlaying: publicProcedure.input(z.any()).query(() => null as unknown as any),
  playToScope: publicProcedure
    .input(z.any())
    .mutation(() => ({ dispatchedTo: 0, affectedStores: 0, directPlayback: null as unknown as { ok?: boolean; error?: string } | null })),
  pause: publicProcedure.input(z.any()).mutation(() => ({ dispatchedTo: 0 })),
  setVolume: publicProcedure.input(z.any()).mutation(() => ({ status: "ok" })),
  disconnect: publicProcedure.input(z.any()).mutation(() => ({ status: "disconnected" })),
});

export const hierarchyRouter = router({
  tree: publicProcedure.query(() =>
    [] as {
      id: string; name: string; code?: string | null;
      provinces: {
        id: string; name: string;
        cities: {
          id: string; name: string;
          stores: {
            id: string; name: string; status: string; address: string;
            counts: { zones: number; onlineZones: number; screens: number; audioZones: number; devices: number; devicesOnline: number };
          }[];
        }[];
      }[];
    }[]
  ),
  createCountry: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  createProvince: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  createCity: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  updateCountry: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "updated" })),
  updateProvince: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "updated" })),
  updateCity: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "updated" })),
});

export const scenesRouter = router({
  list: publicProcedure.query(() => [] as { id: string; name: string; description?: string | null; presetId: string; contentPlaylistId?: string | null; audioPlaylistId?: string | null; audioVolume?: number | null; transitionMs?: number | null }[]),
  save: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "created" })),
  delete: publicProcedure.input(z.any()).mutation(() => ({ id: "", status: "deleted" })),
  trigger: publicProcedure
    .input(z.object({ sceneId: z.string(), scope: scopeEnum, targetId: z.string() }))
    .mutation(() => ({ commandId: "", sceneName: "", components: { rgb: true, content: true, audio: true }, targets: 0 })),
});

export const commandsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        targetId: z.string().optional(),
        status: z.enum(["dispatched", "partial", "complete", "failed"]).optional(),
        kind: z.string().optional(),
        limit: z.number().optional(),
      })
    )
    .query(() => [] as { commandId: string; kind: string; scope: string; targetId: string; status: string; createdAt: string | Date | null }[]),
  get: publicProcedure.input(z.object({ commandId: z.string() })).query(() => ({} as any)),
});

export const appRouter = router({
  auth: authRouter,
  stores: storesRouter,
  rgb: rgbRouter,
  content: contentRouter,
  audio: audioRouter,
  sync: syncRouter,
  analytics: analyticsRouter,
  sponsor: sponsorRouter,
  telemetry: telemetryRouter,
  schedules: schedulesRouter,
  firmware: firmwareRouter,
  alerts: alertsRouter,
  spotify: spotifyRouter,
  hierarchy: hierarchyRouter,
  scenes: scenesRouter,
  commands: commandsRouter,
  health: router({
    ping: publicProcedure.query(() => ({ status: "ok", version: "2.0.0" })),
  }),
});

export type AppRouter = typeof appRouter;
