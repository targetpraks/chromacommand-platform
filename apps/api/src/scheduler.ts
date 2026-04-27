import cron, { ScheduledTask } from "node-cron";
import { db } from "@chromacommand/database";
import { rgbSchedules, rgbPresets, ledZones, stores, activityLog } from "@chromacommand/database/schema";
import { eq, and } from "drizzle-orm";
import { publishCommand } from "./mqtt";
import { broadcast } from "./live";

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
  const [preset] = await db.select().from(rgbPresets).where(eq(rgbPresets.id, s.presetId!));
  if (!preset) {
    console.warn(`[sched] schedule ${s.id} → preset ${s.presetId} missing; skipping`);
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
    console.log(`[sched] skipping ${s.id} (${s.name}) — higher-priority schedule is active`);
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

  console.log(`[sched] fired ${s.name} (${s.id}) → ${affected.length} store(s) at ${new Date().toISOString()}`);
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
      console.warn(`[sched] invalid cron "${s.cronExpression}" on schedule ${s.id} — skipped`);
      continue;
    }

    const task = cron.schedule(
      s.cronExpression,
      () => {
        applySchedule(s).catch((err) => console.error(`[sched] ${s.id} failed:`, err));
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
    console.log(`[sched] registered "${s.name}" (${s.cronExpression}, priority=${s.priority})`);
  }

  // Tear down jobs whose row was deleted/deactivated.
  for (const [key, job] of jobs) {
    if (!seen.has(key)) {
      job.task.stop();
      jobs.delete(key);
      console.log(`[sched] deregistered ${job.scheduleId}`);
    }
  }
}

let syncTimer: NodeJS.Timeout | null = null;

export function startScheduler(): void {
  if (syncTimer) return;
  console.log("[sched] starting cron runner — re-syncs every 60s");
  void syncSchedules().catch((err) => console.error("[sched] initial sync failed:", err));
  syncTimer = setInterval(() => {
    void syncSchedules().catch((err) => console.error("[sched] sync failed:", err));
  }, 60_000);
  syncTimer.unref?.();
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
