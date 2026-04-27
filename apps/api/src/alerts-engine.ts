import { db } from "@chromacommand/database";
import { alertRules, alertEvents, sensorTelemetry, stores } from "@chromacommand/database/schema";
import { and, eq, gte, sql, desc, isNull } from "drizzle-orm";
import { broadcast } from "./live";

/**
 * Alert engine — evaluates alert_rules against sensor_telemetry every 60s.
 * For each active rule:
 *   1. Pull samples for the rule's metric since (now - sustainedMinutes).
 *   2. If EVERY sample violates the comparator, fire — unless an
 *      identical alert is already open (no resolvedAt) within cooldown.
 *   3. POST to the rule's webhook (Slack-compatible JSON) on fire.
 *   4. When the metric drops back to safe, mark the open event resolved.
 *
 * Built-in: R638 fridge temp compliance. Seeded by default.
 */

const COMPARATORS = {
  ">": (a: number, b: number) => a > b,
  "<": (a: number, b: number) => a < b,
  ">=": (a: number, b: number) => a >= b,
  "<=": (a: number, b: number) => a <= b,
  "==": (a: number, b: number) => a === b,
} as const;

let timer: NodeJS.Timeout | null = null;

async function postWebhook(url: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error("[alerts] webhook failed:", (err as Error).message);
    return false;
  }
}

function slackPayload(rule: typeof alertRules.$inferSelect, storeId: string, value: number, message: string) {
  const emoji = rule.severity === "critical" ? "🚨" : rule.severity === "warning" ? "⚠️" : "ℹ️";
  return {
    text: `${emoji} ChromaCommand Alert: ${rule.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *${rule.name}*\n${message}`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Store:*\n${storeId}` },
          { type: "mrkdwn", text: `*Metric:*\n${rule.metric}` },
          { type: "mrkdwn", text: `*Observed:*\n${value.toFixed(2)}` },
          { type: "mrkdwn", text: `*Threshold:*\n${rule.comparator} ${rule.threshold}` },
        ],
      },
    ],
  };
}

async function affectedStoreIds(rule: typeof alertRules.$inferSelect): Promise<string[]> {
  if (rule.scope === "store") return [rule.targetId];
  const all = await db.select().from(stores);
  if (rule.scope === "region") return all.filter((s) => s.regionId === rule.targetId).map((s) => s.id);
  return all.map((s) => s.id);
}

async function evaluateRule(rule: typeof alertRules.$inferSelect): Promise<void> {
  if (!rule.active) return;
  const cmp = COMPARATORS[rule.comparator as keyof typeof COMPARATORS];
  if (!cmp) return;

  const sustainedMs = (rule.sustainedMinutes ?? 0) * 60_000;
  const since = new Date(Date.now() - Math.max(sustainedMs, 60_000));
  const cooldownSince = new Date(Date.now() - (rule.cooldownMinutes ?? 15) * 60_000);

  const stores = await affectedStoreIds(rule);

  for (const storeId of stores) {
    // Pull recent samples within sustained window.
    const samples = await db
      .select()
      .from(sensorTelemetry)
      .where(and(
        eq(sensorTelemetry.storeId, storeId),
        eq(sensorTelemetry.metric, rule.metric),
        gte(sensorTelemetry.recordedAt, since)
      ))
      .orderBy(desc(sensorTelemetry.recordedAt));

    if (samples.length === 0) continue;

    const allViolate = samples.every((s) => cmp(s.value, rule.threshold));
    const noneViolate = samples.every((s) => !cmp(s.value, rule.threshold));
    const observed = samples[0].value;

    // Existing open event for this rule+store?
    const [open] = await db
      .select()
      .from(alertEvents)
      .where(and(
        eq(alertEvents.ruleId, rule.id),
        eq(alertEvents.storeId, storeId),
        isNull(alertEvents.resolvedAt)
      ))
      .orderBy(desc(alertEvents.firedAt))
      .limit(1);

    if (allViolate) {
      // Cooldown gate: don't fire if we just fired for this rule+store.
      const [recent] = await db
        .select()
        .from(alertEvents)
        .where(and(
          eq(alertEvents.ruleId, rule.id),
          eq(alertEvents.storeId, storeId),
          gte(alertEvents.firedAt, cooldownSince)
        ))
        .orderBy(desc(alertEvents.firedAt))
        .limit(1);

      if (open || recent) continue; // already alerted

      const message = `${rule.metric} = ${observed.toFixed(2)} (threshold ${rule.comparator} ${rule.threshold}) for ${rule.sustainedMinutes ?? 0}m+`;
      const [event] = await db
        .insert(alertEvents)
        .values({
          ruleId: rule.id,
          storeId,
          metric: rule.metric,
          observedValue: observed,
          threshold: rule.threshold,
          severity: rule.severity ?? "warning",
          message,
        })
        .returning();

      let delivered = false;
      if (rule.webhookUrl) {
        delivered = await postWebhook(rule.webhookUrl, slackPayload(rule, storeId, observed, message));
        await db.update(alertEvents).set({ webhookDelivered: delivered }).where(eq(alertEvents.id, event.id));
      }

      broadcast({
        type: "alert_fired",
        storeId,
        payload: { ruleId: rule.id, ruleName: rule.name, severity: rule.severity, observed, threshold: rule.threshold, message },
      });

      console.log(`[alerts] 🔥 ${rule.severity} fired: ${rule.name} @ ${storeId} (obs=${observed.toFixed(2)})${delivered ? " [webhook ok]" : ""}`);
    } else if (open && noneViolate) {
      // Auto-resolve.
      await db.update(alertEvents).set({ resolvedAt: new Date() }).where(eq(alertEvents.id, open.id));
      broadcast({
        type: "alert_resolved",
        storeId,
        payload: { ruleId: rule.id, ruleName: rule.name, eventId: open.id },
      });
      console.log(`[alerts] ✓ resolved: ${rule.name} @ ${storeId}`);
    }
  }
}

async function evalAll(): Promise<void> {
  const rules = await db.select().from(alertRules).where(eq(alertRules.active, true));
  for (const r of rules) {
    try {
      await evaluateRule(r);
    } catch (err) {
      console.error(`[alerts] rule ${r.id} (${r.name}) failed:`, (err as Error).message);
    }
  }
}

export function startAlertsEngine(): void {
  if (timer) return;
  console.log("[alerts] starting evaluation engine — every 60s");
  void evalAll().catch((err) => console.error("[alerts] initial eval failed:", err));
  timer = setInterval(() => void evalAll().catch(() => {}), 60_000);
  timer.unref?.();
}

export function stopAlertsEngine(): void {
  if (timer) { clearInterval(timer); timer = null; }
}

export { evalAll as evaluateAllRules };
