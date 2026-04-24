import { router } from "../trpc";
import { storesRouter } from "./stores";
import { rgbRouter } from "./rgb";
import { contentRouter } from "./content";
import { audioRouter } from "./audio";
import { syncRouter } from "./sync";
import { analyticsRouter } from "./analytics";
import { sponsorRouter } from "./sponsor";

export const appRouter = router({
  stores: storesRouter,
  rgb: rgbRouter,
  content: contentRouter,
  audio: audioRouter,
  sync: syncRouter,
  analytics: analyticsRouter,
  sponsor: sponsorRouter,
  health: router({
    ping: router({ query: () => ({ status: "ok", version: "1.1.0" }) }),
  }),
});

export type AppRouter = typeof appRouter;
