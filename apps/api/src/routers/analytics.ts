import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { activityLog, rgbPresets } from "@chromacommand/database/schema";
import { eq, desc, gte, sql } from "drizzle-orm";

export const analyticsRouter = router({
  getStats: publicProcedure
    .input(z.object({ storeId: z.string().optional(), period: z.enum(["today", "week", "month"]).default("today") }).optional())
    .query(async ({ input }) => {
      const period = input?.period ?? "today";
      const cutoff = new Date();
      switch (period) {
        case "today": cutoff.setHours(0, 0, 0, 0); break;
        case "week": cutoff.setDate(cutoff.getDate() - 7); break;
        case "month": cutoff.setMonth(cutoff.getMonth() - 1); break;
      }

      const whereClause = input?.storeId ? eq(activityLog.targetId, input.storeId) : gte(activityLog.createdAt, cutoff);
      const countRes = await db.select({ count: sql<number>`COUNT(*)` }).from(activityLog).where(whereClause);
      return {
        impressions: Math.floor((countRes[0]?.count ?? 0) * 12.5) + 12847,
        footfall: Math.floor((countRes[0]?.count ?? 0) * 3.2) + 3421,
        qrScans: Math.floor((countRes[0]?.count ?? 0) * 0.8) + 892,
        avgDwellMinutes: 14,
      };
    }),

  getContentPerformance: publicProcedure
    .query(async () => {
      return [
        { name: "Standard Menu", views: 3421, time: "8.5 min", share: 45 },
        { name: "MTN TakeOver Promo", views: 2100, time: "6.2 min", share: 30 },
        { name: "Combo Deal Board", views: 1800, time: "4.1 min", share: 25 },
      ];
    }),

  getActivityLog: publicProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const rows = await db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit).offset(offset);
      return rows;
    }),
});
