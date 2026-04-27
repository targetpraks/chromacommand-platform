import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { db } from "@chromacommand/database";
import { alertRules, alertEvents } from "@chromacommand/database/schema";
import { eq, desc, sql } from "drizzle-orm";
import { evaluateAllRules } from "../alerts-engine";

export const alertsRouter = router({
  listRules: protectedProcedure.query(async () => db.select().from(alertRules).orderBy(desc(alertRules.createdAt))),

  recentEvents: protectedProcedure
    .input(z.object({ storeId: z.string().optional(), limit: z.number().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      return input?.storeId
        ? db.select().from(alertEvents).where(eq(alertEvents.storeId, input.storeId)).orderBy(desc(alertEvents.firedAt)).limit(limit)
        : db.select().from(alertEvents).orderBy(desc(alertEvents.firedAt)).limit(limit);
    }),

  createRule: requireRole("hq_admin", "regional_manager")
    .input(z.object({
      name: z.string().min(1).max(128),
      description: z.string().optional(),
      metric: z.string(),
      comparator: z.enum([">", "<", ">=", "<=", "=="]),
      threshold: z.number(),
      sustainedMinutes: z.number().int().min(0).max(1440).default(0),
      scope: z.enum(["global", "region", "store"]),
      targetId: z.string(),
      severity: z.enum(["info", "warning", "critical"]).default("warning"),
      webhookUrl: z.string().url().optional(),
      cooldownMinutes: z.number().int().min(1).max(1440).default(15),
      active: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const [row] = await db.insert(alertRules).values(input).returning();
      return row;
    }),

  updateRule: requireRole("hq_admin", "regional_manager")
    .input(z.object({
      id: z.string().uuid(),
      patch: z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        threshold: z.number().optional(),
        sustainedMinutes: z.number().int().min(0).max(1440).optional(),
        severity: z.enum(["info", "warning", "critical"]).optional(),
        webhookUrl: z.string().url().nullable().optional(),
        cooldownMinutes: z.number().int().min(1).max(1440).optional(),
        active: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const [row] = await db.update(alertRules).set(input.patch as any).where(eq(alertRules.id, input.id)).returning();
      return row;
    }),

  deleteRule: requireRole("hq_admin")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(alertRules).where(eq(alertRules.id, input.id));
      return { ok: true };
    }),

  /** Force an evaluation pass — useful from the dashboard "Test alerts" button. */
  evalNow: requireRole("hq_admin", "technician").mutation(async () => {
    await evaluateAllRules();
    return { ok: true };
  }),

  /** Counts of fired/resolved/active alerts in the last N hours. */
  summary: protectedProcedure
    .input(z.object({ hours: z.number().int().min(1).max(720).default(24) }).optional())
    .query(async ({ input }) => {
      const hours = input?.hours ?? 24;
      const since = new Date(Date.now() - hours * 3600_000);
      const result = await db.execute(sql`
        SELECT severity,
               COUNT(*)::int AS fired,
               COUNT(resolved_at)::int AS resolved,
               COUNT(*) FILTER (WHERE resolved_at IS NULL)::int AS active
        FROM alert_events
        WHERE fired_at >= ${since}
        GROUP BY severity
      `);
      return result.rows;
    }),
});
