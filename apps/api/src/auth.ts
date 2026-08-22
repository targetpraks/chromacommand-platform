import { TRPCError } from "@trpc/server";
import { initTRPC } from "@trpc/server";
import type { FastifyRequest } from "fastify";
import jwt, { type SignOptions } from "jsonwebtoken";
import { db } from "@chromacommand/database";
import { users } from "@chromacommand/database/schema";
import { eq } from "drizzle-orm";
import { satisfiesScopes } from "./targets";

export type Role =
  | "hq_admin"
  | "regional_manager"
  | "franchisee"
  | "sponsor_viewer"
  | "technician";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  orgId: string | null;
  scope: string[]; // ["store:pp-a01", "region:cape-town", "org:infx", "*"]
}

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_TTL = process.env.JWT_TTL || "1h";              // Short-lived access token
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30); // Long-lived refresh token

export const REFRESH_TTL_SECONDS = REFRESH_TTL_DAYS * 86_400;

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, orgId: user.orgId, scope: user.scope, typ: "access" },
    JWT_SECRET,
    { expiresIn: JWT_TTL as SignOptions["expiresIn"] }
  );
}

/** Refresh tokens carry only the user id and a jti for revocation tracking. */
export function signRefreshToken(userId: string, jti: string): string {
  return jwt.sign(
    { sub: userId, jti, typ: "refresh" },
    JWT_SECRET,
    { expiresIn: `${REFRESH_TTL_DAYS}d` }
  );
}

export function verifyRefreshToken(token: string): { userId: string; jti: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.typ !== "refresh") return null;
    return { userId: payload.sub, jti: payload.jti };
  } catch {
    return null;
  }
}

export async function userFromRequest(req: FastifyRequest): Promise<AuthUser | null> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      orgId: payload.orgId ?? null,
      scope: Array.isArray(payload.scope) ? payload.scope : [],
    };
  } catch {
    return null;
  }
}

export async function loginWithEmail(email: string, password: string): Promise<AuthUser | null> {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }
  // Dev-mode shared password for all accounts.
  if (password !== "freakazoid") return null;
  const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role as Role,
    orgId: row.orgId ?? null,
    scope: Array.isArray(row.scope) ? (row.scope as string[]) : [],
  };
}

export interface Ctx {
  req: FastifyRequest;
  user: AuthUser | null;
}

const t = initTRPC.context<Ctx>().create();
export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/**
 * Authorization helper. Pass a function that derives the resource scopes
 * (e.g. ["store:pp-a01"]) from the input. Allows when user has any matching
 * scope, "*" wildcard, or an ancestor geo claim that contains the resource
 * (region:cape-town covers store:pp-a01; province:x covers its cities' stores).
 */
export function requireScope<TInput>(
  resolver: (input: TInput) => string[]
) {
  return t.procedure.use(async ({ ctx, next, getRawInput }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
    }
    const rawInput = await getRawInput();
    const required = resolver((rawInput ?? {}) as TInput);
    if (required.length === 0) {
      return next({ ctx: { ...ctx, user: ctx.user } });
    }
    const ok = await satisfiesScopes(ctx.user.scope, required);
    if (!ok) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing required scope. Need: ${required.join(", ")}`,
      });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export function requireRole(...roles: Role[]) {
  return t.procedure.use(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (!roles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requires role: ${roles.join(" | ")}`,
      });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}
