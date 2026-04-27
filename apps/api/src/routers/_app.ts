import { router, publicProcedure } from "../trpc";
import { storesRouter } from "./stores";
import { rgbRouter } from "./rgb";
import { contentRouter } from "./content";
import { audioRouter } from "./audio";
import { syncRouter } from "./sync";
import { analyticsRouter } from "./analytics";
import { sponsorRouter } from "./sponsor";
import { authRouter } from "./auth";
import { telemetryRouter } from "./telemetry";
import { schedulesRouter } from "./schedules";
import { firmwareRouter } from "./firmware";
import { alertsRouter } from "./alerts";

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
  health: router({
    ping: publicProcedure.query(() => ({ status: "ok", version: "1.2.0" })),
  }),
});

export type AppRouter = typeof appRouter;
