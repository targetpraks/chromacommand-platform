import { router, protectedProcedure, requireRole } from "../trpc";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { sensorTelemetry, deviceHeartbeats } from "@chromacommand/database/schema";
import { and, eq, gte, sql, desc } from "drizzle-orm";

export const telemetryRouter = router({
  /** Recent samples for one store/metric (default last 24h). */
  getSeries: protectedProcedure
    .input(
      z.object({
        storeId: z.string(),
        metric: z.string(),
        sinceMinutes: z.number().min(1).max(43200).default(1440),
        bucketMinutes: z.number().min(1).max(60).default(15),
      })
    )
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.sinceMinutes * 60_000);
      // Bucketed average (or sum for counters) using PG date_bin.
      const bucketSec = input.bucketMinutes * 60;
      const rows = await db.execute(sql`
        SELECT
          date_bin(${sql.raw(`'${bucketSec} seconds'`)}::interval, recorded_at, TIMESTAMPTZ '2026-01-01') AS bucket,
          AVG(value)::float AS avg_value,
          SUM(value)::float AS sum_value,
          COUNT(*)::int AS samples
        FROM sensor_telemetry
        WHERE store_id = ${input.storeId}
          AND metric = ${input.metric}
          AND recorded_at >= ${since}
        GROUP BY bucket
        ORDER BY bucket ASC
      `);
      return rows.rows as Array<{
        bucket: string;
        avg_value: number;
        sum_value: number;
        samples: number;
      }>;
    }),

  /** Latest reading per store for a metric (e.g. fridge temperature). */
  latest: protectedProcedure
    .input(z.object({ metric: z.string(), storeId: z.string().optional() }))
    .query(async ({ input }) => {
      const where = input.storeId
        ? and(eq(sensorTelemetry.metric, input.metric), eq(sensorTelemetry.storeId, input.storeId))
        : eq(sensorTelemetry.metric, input.metric);
      const rows = await db
        .select()
        .from(sensorTelemetry)
        .where(where)
        .orderBy(desc(sensorTelemetry.recordedAt))
        .limit(input.storeId ? 1 : 100);
      return rows;
    }),

  /** Heartbeats — which devices are alive in the last N minutes. */
  liveDevices: protectedProcedure
    .input(z.object({ withinMinutes: z.number().min(1).max(60).default(5) }))
    .query(async ({ input }) => {
      const cutoff = new Date(Date.now() - input.withinMinutes * 60_000);
      const rows = await db
        .select()
        .from(deviceHeartbeats)
        .where(gte(deviceHeartbeats.lastSeen, cutoff));
      return rows;
    }),

  /**
   * Manual telemetry ingestion endpoint — useful for testing without MQTT,
   * for ingesting historic CSV uploads, or for HTTP-only edge devices.
   * Restricted to technicians + admins.
   */
  ingest: requireRole("technician", "hq_admin")
    .input(
      z.object({
        storeId: z.string(),
        samples: z.array(
          z.object({
            sensorId: z.string(),
            metric: z.string(),
            value: z.number(),
            recordedAt: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      if (input.samples.length === 0) return { inserted: 0 };
      const rows = input.samples.map((s) => ({
        storeId: input.storeId,
        sensorId: s.sensorId,
        metric: s.metric,
        value: s.value,
        recordedAt: s.recordedAt ? new Date(s.recordedAt) : new Date(),
      }));
      await db.insert(sensorTelemetry).values(rows);
      return { inserted: rows.length };
    }),
});
