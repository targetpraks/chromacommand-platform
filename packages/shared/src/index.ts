// ─── SHARED TYPE EXPORTS ────────────────────────────────────────
// This package exports schemas and tRPC type stubs.
// The real appRouter (with DB logic) lives in @chromacommand/api.
// This stub enables the dashboard to get AppRouter type inference.

export * from "./schemas";
export * from "./types";
export { t, router, publicProcedure } from "./trpc";
export { appRouter } from "./router-stub";
export type { AppRouter } from "./router-stub";
