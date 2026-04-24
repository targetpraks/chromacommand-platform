import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import jwt from "@fastify/jwt";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./routers/_app";
import { createContext } from "./trpc";
import { registerLiveRoutes, broadcast } from "./live";
import dotenv from "dotenv";

export { broadcast };

dotenv.config();

const fastify = Fastify({ logger: true });

async function main() {
  await fastify.register(cors, { origin: ["http://localhost:3000"] });
  await fastify.register(websocket);
  await fastify.register(jwt, { secret: process.env.JWT_SECRET || "dev-secret-change-me" });

  registerLiveRoutes(fastify);

  await fastify.register(fastifyTRPCPlugin, {
    prefix: "/api/trpc",
    trpcOptions: { router: appRouter, createContext },
  });

  await fastify.listen({ port: 4000, host: "0.0.0.0" });
  fastify.log.info("🚀 ChromaCommand API on http://0.0.0.0:4000");
  fastify.log.info("📡 Live WebSocket on ws://0.0.0.0:4000/live/ws");
}

main().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
