import { initTRPC } from "@trpc/server";
import { FastifyRequest } from "fastify";

export async function createContext({ req }: { req: FastifyRequest }) {
  return { req, user: null as any };
}

const t = initTRPC.context<typeof createContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Routers
import { rgbRouter } from "./rgb";
import { contentRouter, syncRouter, audioRouter, storesRouter } from "./content";

export const appRouter = router({
  rgb: rgbRouter,
  content: contentRouter,
  audio: audioRouter,
  sync: syncRouter,
  stores: storesRouter,
  health: publicProcedure.query(() => ({ status: "ok", version: "1.0.0" })),
});

export type AppRouter = typeof appRouter;
