import type { FastifyInstance } from "fastify";
import { db } from "@chromacommand/database";
import { stores, deviceHeartbeats } from "@chromacommand/database/schema";
import { sql } from "drizzle-orm";

const counters = {
  apiRequests: new Map<string, number>(),
  mqttPublish: new Map<string, number>(),
};

export function bumpCounter(name: keyof typeof counters, labels: string): void {
  counters[name].set(labels, (counters[name].get(labels) ?? 0) + 1);
}

export function registerMetrics(fastify: FastifyInstance): void {
  // Cheap request counter — labels: method+route+status.
  fastify.addHook("onResponse", async (req, reply) => {
    const route = (req.routeOptions?.url as string | undefined) ?? req.url;
    bumpCounter("apiRequests", `${req.method},${route},${reply.statusCode}`);
  });

  fastify.get("/metrics", async (_req, reply) => {
    const lines: string[] = [];

    lines.push("# HELP cc_api_requests_total Total HTTP requests");
    lines.push("# TYPE cc_api_requests_total counter");
    for (const [labels, value] of counters.apiRequests) {
      const [method, route, status] = labels.split(",");
      lines.push(
        `cc_api_requests_total{method="${method}",route="${route}",status="${status}"} ${value}`
      );
    }

    lines.push("# HELP cc_mqtt_publish_total Total MQTT publishes");
    lines.push("# TYPE cc_mqtt_publish_total counter");
    for (const [labels, value] of counters.mqttPublish) {
      const [topic, qos, result] = labels.split(",");
      lines.push(
        `cc_mqtt_publish_total{topic_root="${topic}",qos="${qos}",result="${result}"} ${value}`
      );
    }

    // Live-derived gauges.
    try {
      const storeRows = await db.select({ id: stores.id, status: stores.status, region: stores.regionId }).from(stores);
      lines.push("# HELP cc_store_online 1 = online, 0 = offline");
      lines.push("# TYPE cc_store_online gauge");
      for (const s of storeRows) {
        const v = s.status === "active" ? 1 : 0;
        lines.push(`cc_store_online{store_id="${s.id}",region="${s.region}"} ${v}`);
      }

      const heartbeats = await db.execute(sql`
        SELECT store_id, EXTRACT(EPOCH FROM (NOW() - MAX(last_seen)))::int AS seconds_since
        FROM device_heartbeats
        GROUP BY store_id
      `);
      lines.push("# HELP cc_store_last_heartbeat_seconds Seconds since last heartbeat");
      lines.push("# TYPE cc_store_last_heartbeat_seconds gauge");
      for (const row of heartbeats.rows as any[]) {
        lines.push(
          `cc_store_last_heartbeat_seconds{store_id="${row.store_id}"} ${row.seconds_since ?? -1}`
        );
      }
    } catch {
      // DB might be unavailable at scrape time — emit only the in-memory counters.
    }

    reply.header("Content-Type", "text/plain; version=0.0.4");
    return lines.join("\n") + "\n";
  });
}
