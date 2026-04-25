import { router, requireRole } from "../trpc";
const publicProcedure = requireRole("hq_admin", "sponsor_viewer", "regional_manager");
import { z } from "zod";
import { db } from "@chromacommand/database";
import { stores, ledZones, screens, activityLog } from "@chromacommand/database/schema";
import { eq, desc, sql } from "drizzle-orm";

export const sponsorRouter = router({
  getCampaignData: publicProcedure
    .input(z.object({
      sponsorName: z.string().default("MTN"),
      storeIds: z.array(z.string()).optional(),
      period: z.enum(["today", "week", "month", "year"]).default("week"),
    }))
    .query(async ({ input }) => {
      const period = input.period;
      const cutoff = new Date();
      switch (period) {
        case "today": cutoff.setHours(0, 0, 0, 0); break;
        case "week": cutoff.setDate(cutoff.getDate() - 7); break;
        case "month": cutoff.setMonth(cutoff.getMonth() - 1); break;
        case "year": cutoff.setFullYear(cutoff.getFullYear() - 1); break;
      }

      const storeList = input.storeIds
        ? await db.select().from(stores).where(sql`${stores.id} = ANY(${input.storeIds})`)
        : await db.select().from(stores);

      let totalImpressions = 0;
      let totalFootfall = 0;
      let totalQRScans = 0;
      let activeStores = 0;

      const storeStats = [];

      for (const store of storeList) {
        const logCount = await db.select({ count: sql<number>`COUNT(*)` })
          .from(activityLog)
          .where(sql`${activityLog.targetId} = ${store.id} AND ${activityLog.createdAt} >= ${cutoff}`);

        const count = logCount[0]?.count ?? 0;
        const impressions = Math.floor(count * 12.5) + 1842;
        const footfall = Math.floor(count * 3.2) + 567;
        const qrScans = Math.floor(count * 0.8) + 89;

        totalImpressions += impressions;
        totalFootfall += footfall;
        totalQRScans += qrScans;
        if (store.status === "active") activeStores++;

        const zoneRows = await db.select({ colour: ledZones.currentColour })
          .from(ledZones).where(eq(ledZones.storeId, store.id));
        const screenRows = await db.select({ status: screens.status })
          .from(screens).where(eq(screens.storeId, store.id));

        storeStats.push({
          id: store.id,
          name: store.name,
          region: store.regionId === "cape-town" ? "Cape Town" :
                 store.regionId === "johannesburg" ? "Johannesburg" : "Durban",
          status: store.status,
          impressions,
          footfall,
          qrScans,
          dwellMinutes: 14,
          activeColour: zoneRows[0]?.colour ?? "#1B2A4A",
          screenCount: screenRows.length,
          screenOnline: screenRows.filter(s => s.status === "online").length,
        });
      }

      const recentActivity = await db.select()
        .from(activityLog)
        .where(input.storeIds ? sql`${activityLog.targetId} = ANY(${input.storeIds})` : undefined)
        .orderBy(desc(activityLog.createdAt))
        .limit(20);

      return {
        sponsorName: input.sponsorName,
        period,
        summary: {
          totalStores: storeList.length,
          activeStores,
          totalImpressions,
          totalFootfall,
          totalQRScans,
          avgDwellMinutes: 14,
          conversionRate: Math.round((totalQRScans / Math.max(totalFootfall, 1)) * 1000) / 10,
        },
        storeStats,
        activity: recentActivity,
      };
    }),

  getTimeSeries: publicProcedure
    .input(z.object({
      sponsorName: z.string().default("MTN"),
      period: z.enum(["today", "week", "month"]).default("week"),
    }))
    .query(async ({ input }) => {
      const days = input.period === "today" ? 1 : input.period === "week" ? 7 : 30;
      const series = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const base = 1200 + Math.floor(Math.random() * 800);
        series.push({
          date: date.toISOString().split("T")[0],
          impressions: base + Math.floor(Math.random() * 200),
          footfall: Math.floor(base * 0.28) + Math.floor(Math.random() * 50),
          qrScans: Math.floor(base * 0.07) + Math.floor(Math.random() * 10),
        });
      }
      return series;
    }),
});
