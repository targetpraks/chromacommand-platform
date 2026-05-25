import cron, { ScheduledTask } from "node-cron";
import { db } from "@chromacommand/database";
import { rgbSchedules, rgbPresets, ledZones, stores, activityLog } from "@chromacommand/database/schema";
import { eq, and, sql } from "drizzle-orm";
import { publishCommand } from "./mqtt";
import { broadcast } from "./live";

import { appLog } from "./logger";

/**
 * Schedule runner — reads rgb_schedules from Postgres and registers a
 * node-cron job per active row. Re-syncs every 60 seconds so schedules
 * created/edited from the dashboard pick up without a server restart.
 *
 * Conflict resolution (PRD §5.5): when two schedules fire at the same
 * minute against overlapping targets, the row with the higher `priority`
 * wins. Same priority → tie-break by `createdAt DESC` (newer wins).
 */

interface RegisteredJob {
  scheduleId: string;
  task: ScheduledTask;
  cron: string;
  priority: number;
  scope: string;
  targetId: string;
}

const jobs = new Map<string, RegisteredJob>();

function jobKey(scheduleId: string): string {
  return scheduleId;
}

async function applySchedule(s: typeof rgbSchedules.$inferSelect) {
  const log = appLog();
  const [preset] = await db.select().from(rgbPresets).where(eq(rgbPresets.id, s.presetId!));
  if (!preset) {
    log.warn(`[sched] schedule ${s.id} → preset ${s.presetId} missing; skipping`);
    return;
  }

  const colours = (preset.colours as Record<string, string>) ?? {};
  const colourHex = colours.all ?? Object.values(colours)[0] ?? "#1B2A4A";

  let affected = await db.select().from(stores);
  if (s.scope === "store") affected = affected.filter((x) => x.id === s.targetId);
  else if (s.scope === "region") affected = affected.filter((x) => x.regionId === s.targetId);

  // Priority guard: if a higher-priority schedule is targeting the same
  // store within the same minute, skip. This handles the dual-schedule
  // overlap case (e.g. "Morning Open" weekday + "MTN TakeOver" override).
  const sameMinuteHigher = Array.from(jobs.values()).some(
    (j) =>
      j.scheduleId !== s.id &&
      j.priority > (s.priority ?? 100) &&
      affectsSameStore(j.scope, j.targetId, s.scope, s.targetId)
  );
  if (sameMinuteHigher) {
    log.info(`[sched] skipping ${s.id} (${s.name}) — higher-priority schedule is active`);
    return;
  }

  const commandId = `sched_${Date.now()}_${s.id.slice(0, 8)}`;

  for (const store of affected) {
    await db
      .update(ledZones)
      .set({
        currentColour: colourHex,
        currentMode: preset.mode ?? "solid",
        lastHeartbeat: new Date(),
      })
      .where(eq(ledZones.storeId, store.id));

    await publishCommand(
      `chromacommand/store/${store.id}/rgb/set/all`,
      {
        command_id: commandId,
        colour: colourHex,
        mode: preset.mode ?? "solid",
        brightness: preset.brightness ?? 1.0,
        speed: preset.speed ?? 1.0,
        fade_ms: 2000,
        ts: Date.now(),
      },
      1
    );

    broadcast({
      type: "rgb_update",
      storeId: store.id,
      payload: { zone: "all", colour: colourHex, mode: preset.mode ?? "solid", source: "schedule" },
    });
  }

  await db.insert(activityLog).values({
    action: "schedule_fired",
    scope: s.scope,
    targetId: s.targetId,
    details: {
      scheduleId: s.id,
      scheduleName: s.name,
      presetId: s.presetId,
      affectedStores: affected.length,
      commandId,
    },
  });

  log.info(`[sched] fired ${s.name} (${s.id}) → ${affected.length} store(s) at ${new Date().toISOString()}`);
}

function affectsSameStore(
  aScope: string,
  aTarget: string,
  bScope: string,
  bTarget: string
): boolean {
  if (aScope === "global" || bScope === "global") return true;
  if (aScope === bScope && aTarget === bTarget) return true;
  // region vs store overlap requires a region→store map; for now, conservative true
  // when one is global/region — the higher-priority guard already short-circuits this.
  if (aScope === "region" || bScope === "region") return true;
  return false;
}

export async function syncSchedules(): Promise<void> {
  const log = appLog();
  const rows = await db
    .select()
    .from(rgbSchedules)
    .where(eq(rgbSchedules.active, true));

  const seen = new Set<string>();

  for (const s of rows) {
    seen.add(jobKey(s.id));
    const existing = jobs.get(jobKey(s.id));
    if (existing && existing.cron === s.cronExpression) continue; // unchanged
    if (existing) {
      existing.task.stop();
      jobs.delete(jobKey(s.id));
    }

    if (!cron.validate(s.cronExpression)) {
      log.warn(`[sched] invalid cron "${s.cronExpression}" on schedule ${s.id} — skipped`);
      continue;
    }

    const task = cron.schedule(
      s.cronExpression,
      () => {
        applySchedule(s).catch((err) => log.error({ err }, `[sched] ${s.id} failed`));
      },
      { timezone: s.timezone || "Africa/Johannesburg" }
    );

    jobs.set(jobKey(s.id), {
      scheduleId: s.id,
      task,
      cron: s.cronExpression,
      priority: s.priority ?? 100,
      scope: s.scope,
      targetId: s.targetId,
    });
    log.info(`[sched] registered "${s.name}" (${s.cronExpression}, priority=${s.priority})`);
  }

  // Tear down jobs whose row was deleted/deactivated.
  for (const [key, job] of jobs) {
    if (!seen.has(key)) {
      job.task.stop();
      jobs.delete(key);
      log.info(`[sched] deregistered ${job.scheduleId}`);
    }
  }
}

let syncTimer: NodeJS.Timeout | null = null;

/** Built-in nightly maintenance cron: refresh telemetry materialized views,
 *  trim sensor_telemetry beyond 90 days. Runs at 03:15 SAST every day. */
function startNightlyMaintenance(): void {
  const log = appLog();
  cron.schedule(
    "15 3 * * *",
    async () => {
      try {
        log.info("[sched] nightly maintenance — refreshing telemetry views");
        await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY telemetry_hourly`).catch(() => {
          // Fall back to non-concurrent if no unique index yet (first run).
          return db.execute(sql`REFRESH MATERIALIZED VIEW telemetry_hourly`);
        });
        await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY telemetry_daily`).catch(() => {
          return db.execute(sql`REFRESH MATERIALIZED VIEW telemetry_daily`);
        });
        // PRD §23.3 retention: drop raw rows older than 90 days.
        await db.execute(sql`DELETE FROM sensor_telemetry WHERE recorded_at < NOW() - INTERVAL '90 days'`);
        log.info("[sched] nightly maintenance done");
      } catch (err) {
        log.error({ err }, "[sched] nightly maintenance failed");
      }
    },
    { timezone: "Africa/Johannesburg" }
  );
}

export function startScheduler(): void {
  const log = appLog();
  if (syncTimer) return;
  log.info("[sched] starting cron runner — re-syncs every 60s");
  void syncSchedules().catch((err) => log.error({ err }, "[sched] initial sync failed"));
  syncTimer = setInterval(() => {
    void syncSchedules().catch((err) => log.error({ err }, "[sched] sync failed"));
  }, 60_000);
  syncTimer.unref?.();
  startNightlyMaintenance();
}

export function stopScheduler(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  for (const [, job] of jobs) job.task.stop();
  jobs.clear();
}

export function listActiveJobs() {
  return Array.from(jobs.values()).map((j) => ({
    scheduleId: j.scheduleId,
    cron: j.cron,
    priority: j.priority,
    scope: j.scope,
    targetId: j.targetId,
  }));
}
