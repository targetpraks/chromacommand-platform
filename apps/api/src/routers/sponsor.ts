import { router, requireRole } from "../trpc";
const publicProcedure = requireRole("hq_admin", "sponsor_viewer", "regional_manager");
import { z } from "zod";
import { db } from "@chromacommand/database";
import { stores, ledZones, screens, activityLog, sponsorActivations, sensorTelemetry } from "@chromacommand/database/schema";
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

      const storeStats: any[] = [];

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
      const series: any[] = [];
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

  /** List billable activations for a sponsor in a date range. */
  listActivations: publicProcedure
    .input(z.object({
      sponsorName: z.string().optional(),
      since: z.string().optional(),  // ISO
      until: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const since = input.since ? new Date(input.since) : new Date(Date.now() - 30 * 86_400_000);
      const until = input.until ? new Date(input.until) : new Date();

      const rows = await db
        .select()
        .from(sponsorActivations)
        .where(
          input.sponsorName
            ? sql`${sponsorActivations.sponsorName} = ${input.sponsorName}
                  AND ${sponsorActivations.startedAt} >= ${since}
                  AND ${sponsorActivations.startedAt} < ${until}`
            : sql`${sponsorActivations.startedAt} >= ${since}
                  AND ${sponsorActivations.startedAt} < ${until}`
        )
        .orderBy(desc(sponsorActivations.startedAt));

      return rows.map((r) => {
        const ended = r.endedAt ?? new Date();
        const durationSec = Math.round((ended.getTime() - new Date(r.startedAt!).getTime()) / 1000);
        return { ...r, durationSeconds: durationSec, ongoing: !r.endedAt };
      });
    }),

  /**
   * Generate an invoice line-item summary for a sponsor for a given period.
   * Pulls impressions from sensor_telemetry across the time window of
   * each activation × the rate.
   */
  invoice: publicProcedure
    .input(z.object({
      sponsorName: z.string(),
      since: z.string(),
      until: z.string(),
    }))
    .query(async ({ input }) => {
      const since = new Date(input.since);
      const until = new Date(input.until);

      const acts = await db
        .select()
        .from(sponsorActivations)
        .where(sql`${sponsorActivations.sponsorName} = ${input.sponsorName}
                   AND ${sponsorActivations.startedAt} >= ${since}
                   AND ${sponsorActivations.startedAt} < ${until}`)
        .orderBy(desc(sponsorActivations.startedAt));

      let totalImpressions = 0;
      let totalCents = 0;
      const lines: any[] = [];

      for (const a of acts) {
        const startedAt = new Date(a.startedAt!);
        const endedAt = a.endedAt ?? until;
        const rate = a.ratePerImpressionCents ?? 5;

        // Sum impressions across affected stores during the activation window.
        const targetClause = a.scope === "store"
          ? sql`AND ${sensorTelemetry.storeId} = ${a.targetId}`
          : sql``;
        const result = await db.execute(sql`
          SELECT COALESCE(SUM(value), 0)::float AS imp
          FROM sensor_telemetry
          WHERE metric = 'impressions'
            AND recorded_at >= ${startedAt}
            AND recorded_at < ${endedAt}
            ${targetClause}
        `);
        const imp = Number((result.rows[0] as any)?.imp ?? 0);
        const cents = Math.round(imp * rate);
        totalImpressions += imp;
        totalCents += cents;

        lines.push({
          activationId: a.id,
          startedAt: a.startedAt,
          endedAt: a.endedAt,
          scope: a.scope,
          targetId: a.targetId,
          impressions: imp,
          ratePerImpressionCents: rate,
          subtotalCents: cents,
        });
      }

      return {
        sponsorName: input.sponsorName,
        period: { since: input.since, until: input.until },
        totals: {
          activations: acts.length,
          impressions: totalImpressions,
          amountCents: totalCents,
          amountZAR: (totalCents / 100).toFixed(2),
        },
        lines,
      };
    }),
});
