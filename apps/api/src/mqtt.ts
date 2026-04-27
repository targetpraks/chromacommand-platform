import mqtt, { MqttClient } from "mqtt";
import { readFileSync, existsSync } from "node:fs";
import { db } from "@chromacommand/database";
import { sensorTelemetry, deviceHeartbeats, screens, activityLog } from "@chromacommand/database/schema";
import { eq } from "drizzle-orm";
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
    clientId: process.env.MQTT_CLIENT_ID || `cc-api-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 10_000,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  };

  // mTLS — load X.509 cert + key + CA chain when broker URL is mqtts://
  if (url.startsWith("mqtts://")) {
    const certPath = process.env.MQTT_CLIENT_CERT;
    const keyPath = process.env.MQTT_CLIENT_KEY;
    const caPath = process.env.MQTT_CA_CERT;
    if (certPath && existsSync(certPath)) opts.cert = readFileSync(certPath);
    if (keyPath && existsSync(keyPath)) opts.key = readFileSync(keyPath);
    if (caPath && existsSync(caPath)) opts.ca = readFileSync(caPath);
    opts.rejectUnauthorized = process.env.MQTT_INSECURE === "1" ? false : true;
    if (opts.cert && opts.key) {
      console.log("[mqtt] mTLS enabled (cert + key loaded)");
    }
  }

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
        "chromacommand/store/+/firmware/state",
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

  // PRD §6.7 — screen auto-discovery. Edge gateway forwards a UDP-multicast
  // discovery to chromacommand/store/{id}/screens/discover.
  // Payload: { mac_address, hardware_type, ip_address, screen_model,
  //            dimensions, firmware_version }
  if (kind === "screens" && sub === "discover") {
    if (!body.mac_address) return;
    // Use mac as natural key (hyphenless lower-case) to derive a stable id
    // when the operator hasn't pre-registered the screen.
    const macKey = body.mac_address.toLowerCase().replace(/[^a-z0-9]/g, "");
    const screenId = body.screen_id || `${storeId}-screen-${macKey.slice(-6)}`;

    const [existing] = await db.select().from(screens).where(eq(screens.macAddress, body.mac_address));
    if (existing) {
      // Update last-seen + firmware on a known device.
      await db
        .update(screens)
        .set({
          status: "online",
          lastHeartbeat: new Date(),
          firmwareVersion: body.firmware_version ?? existing.firmwareVersion,
          ipAddress: body.ip_address ?? existing.ipAddress,
        })
        .where(eq(screens.id, existing.id));
      broadcast({
        type: "screen_status",
        storeId,
        payload: { screenId: existing.id, status: "online" },
      });
      return;
    }

    // New device — register it.
    await db.insert(screens).values({
      id: screenId,
      storeId,
      screenType: body.screen_model?.includes("eink") ? "eink" : body.screen_model || "lcd",
      hardwareType: body.hardware_type || null,
      macAddress: body.mac_address,
      ipAddress: body.ip_address || null,
      dimensions: body.dimensions || null,
      firmwareVersion: body.firmware_version || null,
      status: "online",
      lastHeartbeat: new Date(),
    });

    await db.insert(activityLog).values({
      action: "screen_discovered",
      scope: "store",
      targetId: storeId,
      details: { screenId, mac: body.mac_address, model: body.screen_model, ip: body.ip_address },
    });

    // Send the screen back its assigned id so the player can persist it locally.
    void publishCommand(
      `chromacommand/store/${storeId}/screens/register`,
      { mac_address: body.mac_address, screen_id: screenId, store_id: storeId, ts: Date.now() },
      1
    );

    broadcast({
      type: "screen_discovered",
      storeId,
      payload: { screenId, mac: body.mac_address, type: body.screen_model },
    });
    return;
  }

  // PRD §6.8 — content state confirmation from screen players.
  if (kind === "content" && sub === "state") {
    broadcast({ type: "content_update", storeId, payload: body });
    return;
  }

  // OTA firmware ack: chromacommand/store/{id}/firmware/state
  // body: { deployment_id, device_id, outcome: "success"|"failed", error? }
  if (kind === "firmware" && sub === "state") {
    if (!body.deployment_id || !body.outcome) return;
    const { firmwareDeployments } = await import("@chromacommand/database/schema");
    const [dep] = await db
      .select()
      .from(firmwareDeployments)
      .where(eq(firmwareDeployments.id, body.deployment_id));
    if (!dep) return;
    const successCount = (dep.successCount ?? 0) + (body.outcome === "success" ? 1 : 0);
    const failureCount = (dep.failureCount ?? 0) + (body.outcome === "failed" ? 1 : 0);
    const total = dep.totalDevices ?? 0;
    let status = dep.status;
    let completedAt = dep.completedAt;
    if (successCount + failureCount >= total && total > 0) {
      status = failureCount === 0 ? "success" : successCount === 0 ? "failed" : "partial";
      completedAt = new Date();
    }
    await db
      .update(firmwareDeployments)
      .set({ successCount, failureCount, status, completedAt })
      .where(eq(firmwareDeployments.id, body.deployment_id));
    broadcast({
      type: "firmware_state",
      storeId,
      payload: { deploymentId: body.deployment_id, outcome: body.outcome, successCount, failureCount, status },
    });
    return;
  }
}
