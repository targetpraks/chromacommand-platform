import mqtt, { MqttClient } from "mqtt";
import { db } from "@chromacommand/database";
import { sensorTelemetry, deviceHeartbeats } from "@chromacommand/database/schema";
import { broadcast } from "./live";
import { bumpCounter } from "./metrics";

let client: MqttClient | null = null;
let connectAttempted = false;
const pendingQueue: Array<{ topic: string; payload: unknown; qos: 0 | 1 | 2 }> = [];

export function initMqtt(): void {
  if (connectAttempted) return;
  connectAttempted = true;

  const url = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
  const opts: mqtt.IClientOptions = {
    clientId: `cc-api-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 10_000,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  };

  console.log(`[mqtt] connecting to ${url}…`);
  const c = mqtt.connect(url, opts);
  client = c;

  c.on("connect", () => {
    console.log("[mqtt] connected");
    // Subscribe to telemetry + state topics from all stores.
    c.subscribe(
      [
        "chromacommand/store/+/telemetry/heartbeat",
        "chromacommand/store/+/telemetry/sensors",
        "chromacommand/store/+/rgb/state/+",
        "chromacommand/store/+/content/state",
        "chromacommand/store/+/screens/discover",
      ],
      { qos: 1 },
      (err) => {
        if (err) console.error("[mqtt] subscribe error:", err.message);
      }
    );
    // Drain anything queued during disconnect.
    while (pendingQueue.length > 0) {
      const item = pendingQueue.shift()!;
      c.publish(item.topic, JSON.stringify(item.payload), { qos: item.qos });
    }
  });

  c.on("error", (err) => console.error("[mqtt] error:", err.message));
  c.on("offline", () => console.warn("[mqtt] offline"));
  c.on("reconnect", () => console.log("[mqtt] reconnecting…"));

  c.on("message", (topic, message) => {
    void handleMessage(topic, message).catch((err) =>
      console.error("[mqtt] handler error:", err)
    );
  });
}

export async function publishCommand(
  topic: string,
  payload: unknown,
  qos: 0 | 1 | 2 = 1
): Promise<void> {
  if (!client || !client.connected) {
    pendingQueue.push({ topic, payload, qos });
    if (pendingQueue.length > 5000) pendingQueue.splice(0, pendingQueue.length - 5000);
    return;
  }
  const topicRoot = topic.split("/").slice(0, 4).join("/");
  return new Promise((resolve, reject) => {
    client!.publish(topic, JSON.stringify(payload), { qos }, (err) => {
      bumpCounter("mqttPublish", `${topicRoot},${qos},${err ? "err" : "ok"}`);
      if (err) reject(err);
      else resolve();
    });
  });
}

async function handleMessage(topic: string, raw: Buffer): Promise<void> {
  // chromacommand/store/{id}/{kind}/{...}
  const parts = topic.split("/");
  if (parts[0] !== "chromacommand" || parts[1] !== "store") return;
  const storeId = parts[2];
  const kind = parts[3];
  const sub = parts[4];

  let body: any = {};
  try {
    body = JSON.parse(raw.toString());
  } catch {
    return;
  }

  if (kind === "telemetry" && sub === "heartbeat") {
    await db
      .insert(deviceHeartbeats)
      .values({
        deviceId: body.device_id || `gateway-${storeId}`,
        deviceType: body.device_type || "gateway",
        storeId,
        lastSeen: new Date(body.ts || Date.now()),
        ipAddress: body.ip || null,
        firmwareVersion: body.version || null,
      })
      .onConflictDoUpdate({
        target: deviceHeartbeats.deviceId,
        set: {
          lastSeen: new Date(body.ts || Date.now()),
          ipAddress: body.ip || null,
          firmwareVersion: body.version || null,
        },
      });
    broadcast({ type: "store_status", storeId, payload: { online: true, ts: Date.now() } });
    return;
  }

  if (kind === "telemetry" && sub === "sensors") {
    // body: { samples: [{ sensor_id, metric, value, recorded_at }, ...] }
    const samples = Array.isArray(body.samples) ? body.samples : [body];
    const rows = samples
      .filter((s: any) => s && s.metric && typeof s.value === "number")
      .map((s: any) => ({
        storeId,
        sensorId: s.sensor_id || "unknown",
        metric: s.metric,
        value: s.value,
        recordedAt: s.recorded_at ? new Date(s.recorded_at) : new Date(),
      }));
    if (rows.length > 0) {
      await db.insert(sensorTelemetry).values(rows);
    }
    return;
  }

  if (kind === "rgb" && sub === "state") {
    broadcast({ type: "rgb_update", storeId, payload: { zone: parts[5], ...body } });
    return;
  }
}
