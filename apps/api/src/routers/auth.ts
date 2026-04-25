import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { loginWithEmail, signToken } from "../auth";
import { consume } from "../rate-limit";

const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_PER_WINDOW = 10;

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const ip =
        (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        ctx.req.ip ||
        "unknown";
      const ipResult = consume(`login:ip:${ip}`, { windowMs: LOGIN_WINDOW_MS, max: LOGIN_MAX_PER_WINDOW });
      const emailResult = consume(`login:email:${input.email.toLowerCase()}`, {
        windowMs: LOGIN_WINDOW_MS,
        max: LOGIN_MAX_PER_WINDOW,
      });

      if (!ipResult.allowed || !emailResult.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many login attempts. Try again in ${Math.ceil(
            Math.max(ipResult.resetIn, emailResult.resetIn) / 1000
          )}s.`,
        });
      }

      const user = await loginWithEmail(input.email, input.password);
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }
      const token = signToken(user);
      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          orgId: user.orgId,
          scope: user.scope,
        },
      };
    }),

  me: protectedProcedure.query(({ ctx }) => ctx.user),
});
