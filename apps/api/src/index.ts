import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import jwt from "@fastify/jwt";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "@chromacommand/shared";
import { createContext } from "./trpc";
import dotenv from "dotenv";

dotenv.config();

const fastify = Fastify({ logger: true });

async function main() {
  await fastify.register(cors, { origin: ["http://localhost:3000"] });
  await fastify.register(websocket);
  await fastify.register(jwt, { secret: process.env.JWT_SECRET || "dev-secret-change-me" });

  await fastify.register(fastifyTRPCPlugin, {
    prefix: "/api/trpc",
    trpcOptions: { router: appRouter, createContext },
  });

  await fastify.listen({ port: 4000, host: "0.0.0.0" });
  fastify.log.info("🚀 ChromaCommand API on http://0.0.0.0:4000");
}

main().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
