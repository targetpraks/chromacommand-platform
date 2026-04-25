import type { FastifyRequest } from "fastify";
import { userFromRequest, router, publicProcedure, protectedProcedure, requireScope, requireRole, type Ctx } from "./auth";

export async function createContext({ req }: { req: FastifyRequest }): Promise<Ctx> {
  const user = await userFromRequest(req);
  return { req, user };
}

export { router, publicProcedure, protectedProcedure, requireScope, requireRole };
