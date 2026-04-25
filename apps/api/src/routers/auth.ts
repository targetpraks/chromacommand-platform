import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { loginWithEmail, signToken } from "../auth";

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input }) => {
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
