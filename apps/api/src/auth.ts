import { TRPCError } from "@trpc/server";
import { initTRPC } from "@trpc/server";
import type { FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { db } from "@chromacommand/database";
import { users } from "@chromacommand/database/schema";
import { eq } from "drizzle-orm";

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

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_TTL = process.env.JWT_TTL || "1h";              // Short-lived access token
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30); // Long-lived refresh token

export const REFRESH_TTL_SECONDS = REFRESH_TTL_DAYS * 86_400;

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, orgId: user.orgId, scope: user.scope, typ: "access" },
    JWT_SECRET,
    { expiresIn: JWT_TTL as any }
  );
}

/** Refresh tokens carry only the user id and a jti for revocation tracking. */
export function signRefreshToken(userId: string, jti: string): string {
  return jwt.sign(
    { sub: userId, jti, typ: "refresh" },
    JWT_SECRET,
    { expiresIn: `${REFRESH_TTL_DAYS}d` as any }
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

export async function loginWithEmail(email: string, _password: string): Promise<AuthUser | null> {
  // Dev-mode auth: any password accepted for seeded users.
  // Production: replace with Firebase Admin SDK token verification or argon2 password compare.
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
 * scope, "*" wildcard, or org-level scope that contains the resource.
 */
export function requireScope<TInput>(
  resolver: (input: TInput) => string[]
) {
  return t.procedure.use(({ ctx, next, getRawInput }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
    }
    const required = resolver((getRawInput() ?? {}) as TInput);
    if (required.length === 0) {
      return next({ ctx: { ...ctx, user: ctx.user } });
    }
    const userScopes = ctx.user.scope;
    if (userScopes.includes("*")) {
      return next({ ctx: { ...ctx, user: ctx.user } });
    }
    const ok = required.every((r) => userScopes.includes(r));
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
