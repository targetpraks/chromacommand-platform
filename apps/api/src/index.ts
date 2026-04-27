import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./routers/_app";
import { createContext } from "./trpc";
import { registerLiveRoutes, broadcast } from "./live";
import { initMqtt } from "./mqtt";
import { registerMetrics } from "./metrics";
import { startScheduler } from "./scheduler";
import dotenv from "dotenv";

export { broadcast };

dotenv.config();

const fastify = Fastify({ logger: true });

async function main() {
  await fastify.register(cors, { origin: process.env.DASHBOARD_ORIGIN?.split(",") ?? ["http://localhost:3000"] });
  await fastify.register(websocket);

  registerLiveRoutes(fastify);
  registerMetrics(fastify);

  await fastify.register(fastifyTRPCPlugin, {
    prefix: "/api/trpc",
    trpcOptions: { router: appRouter, createContext },
  });

  // Lazy-init MQTT — non-fatal if broker is down at startup.
  try {
    initMqtt();
  } catch (err) {
    fastify.log.warn({ err }, "[mqtt] init failed — commands will queue");
  }

  // Schedule runner — also non-fatal if DB is unreachable at startup;
  // re-sync ticks will pick up once DB recovers.
  if (process.env.DISABLE_SCHEDULER !== "1") {
    try {
      startScheduler();
    } catch (err) {
      fastify.log.warn({ err }, "[sched] startup failed");
    }
  }

  await fastify.listen({ port: Number(process.env.PORT ?? 4000), host: "0.0.0.0" });
  fastify.log.info("🚀 ChromaCommand API on http://0.0.0.0:4000");
  fastify.log.info("📡 Live WebSocket on ws://0.0.0.0:4000/live/ws");
  fastify.log.info("📊 Metrics on http://0.0.0.0:4000/metrics");
}

main().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
