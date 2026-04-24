import { FastifyRequest } from "fastify";
import { initTRPC } from "@trpc/server";

export async function createContext({ req }: { req: FastifyRequest }) {
  return { req, user: null as any };
}

const t = initTRPC.context<typeof createContext>().create();
export const router = t.router;
export const publicProcedure = t.procedure;
