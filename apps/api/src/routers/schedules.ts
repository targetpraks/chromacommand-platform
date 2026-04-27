import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole, requireScope } from "../trpc";
import { db } from "@chromacommand/database";
import { rgbSchedules } from "@chromacommand/database/schema";
import { eq, desc } from "drizzle-orm";
import cron from "node-cron";
import { syncSchedules, listActiveJobs } from "../scheduler";
import { scopeFromRequest } from "../scope";

const createInput = z.object({
  name: z.string().min(1).max(64),
  presetId: z.string().uuid(),
  scope: z.enum(["global", "region", "store"]),
  targetId: z.string(),
  cronExpression: z.string(),
  timezone: z.string().default("Africa/Johannesburg"),
  active: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(100),
});

const updateInput = createInput.partial().extend({ id: z.string().uuid() });

export const schedulesRouter = router({
  list: protectedProcedure
    .input(z.object({ targetId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const rows = input?.targetId
        ? await db.select().from(rgbSchedules).where(eq(rgbSchedules.targetId, input.targetId)).orderBy(desc(rgbSchedules.createdAt))
        : await db.select().from(rgbSchedules).orderBy(desc(rgbSchedules.createdAt));
      return rows;
    }),

  create: requireScope<z.infer<typeof createInput>>((i) => scopeFromRequest(i))
    .input(createInput)
    .mutation(async ({ input }) => {
      if (!cron.validate(input.cronExpression)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid cron expression "${input.cronExpression}"`,
        });
      }
      const [row] = await db.insert(rgbSchedules).values(input).returning();
      // Pick up immediately rather than waiting for the next 60s sync.
      void syncSchedules().catch(() => {});
      return row;
    }),

  update: requireRole("hq_admin", "regional_manager")
    .input(updateInput)
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      if (patch.cronExpression && !cron.validate(patch.cronExpression)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid cron expression "${patch.cronExpression}"`,
        });
      }
      const [row] = await db
        .update(rgbSchedules)
        .set(patch)
        .where(eq(rgbSchedules.id, id))
        .returning();
      void syncSchedules().catch(() => {});
      return row;
    }),

  remove: requireRole("hq_admin", "regional_manager")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(rgbSchedules).where(eq(rgbSchedules.id, input.id));
      void syncSchedules().catch(() => {});
      return { ok: true };
    }),

  /** Debug: which jobs are registered in this API instance right now. */
  activeJobs: requireRole("hq_admin", "technician").query(() => listActiveJobs()),
});
