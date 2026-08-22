import { db } from "@chromacommand/database";
import { commands } from "@chromacommand/database/schema";
import { eq, desc, and, or, type SQL } from "drizzle-orm";
import { publishCommand } from "./mqtt";
import { broadcast } from "./live";
import { resolveStoreTargets } from "./targets";
import { appLog } from "./logger";

export interface DispatchSpec {
  /** Ledger kind, e.g. "rgb.set" | "audio.set" | "screen.command". */
  kind: string;
  scope: string;
  targetId: string;
  /** Base payload merged into every per-store message (command_id/ts added). */
  payload: Record<string, unknown>;
  /**
   * Build the MQTT topic + body for one store. Return null to skip a store.
   * The command id is injected into every body automatically.
   */
  build: (storeId: string, commandId: string) => { topic: string; body: Record<string, unknown> } | null;
  userId?: string | null;
  qos?: 0 | 1 | 2;
}

export function newCommandId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Fan a command out to every store covered by scope+target, recording the
 * dispatch in the command ledger. Returns the resolved store list so callers
 * can layer extra work (state writes, sponsor hooks) on top.
 */
export async function dispatchToStores(
  spec: DispatchSpec
): Promise<{ commandId: string; storeIds: string[] }> {
  const log = appLog();
  const resolved = await resolveStoreTargets({ scope: spec.scope, targetId: spec.targetId });
  const commandId = newCommandId(spec.kind.replace(/[.\-]/g, "_"));
  const qos = spec.qos ?? 1;

  await db.insert(commands).values({
    commandId,
    kind: spec.kind,
    scope: spec.scope,
    targetId: spec.targetId,
    payload: spec.payload,
    targets: { stores: resolved.storeIds },
    ackState: {},
    status: "dispatched",
    initiatedBy: spec.userId ?? null,
  });

  let dispatched = 0;
  for (const storeId of resolved.storeIds) {
    const built = spec.build(storeId, commandId);
    if (!built) continue;
    try {
      await publishCommand(built.topic, { command_id: commandId, ts: Date.now(), ...spec.payload, ...built.body }, qos);
      dispatched++;
    } catch (err) {
      log.error({ err, storeId, kind: spec.kind }, "[dispatch] publish failed");
    }
  }

  if (dispatched === 0 && resolved.storeIds.length > 0) {
    await db.update(commands).set({ status: "failed", completedAt: new Date() }).where(eq(commands.commandId, commandId));
  }

  return { commandId, storeIds: resolved.storeIds };
}

/**
 * Record a device acknowledgement against a command. Merges into ack_state
 * and rolls the overall status forward: complete → partial → failed.
 */
export async function recordAck(commandId: string, deviceId: string, outcome: "acked" | "failed" | "timeout", detail?: unknown): Promise<void> {
  const [row] = await db.select().from(commands).where(eq(commands.commandId, commandId)).limit(1);
  if (!row) return;

  const ackState = { ...((row.ackState as Record<string, unknown>) ?? {}) };
  ackState[deviceId] = { status: outcome, at: new Date().toISOString(), detail };

  const total = ((row.targets as { stores?: string[] })?.stores?.length ?? 0);
  const acks = Object.values(ackState).filter((a: any) => a.status !== "timeout");
  const failed = Object.values(ackState).filter((a: any) => a.status === "failed").length;

  let status = row.status;
  let completedAt = row.completedAt;
  if (total > 0 && acks.length >= total) {
    status = failed === 0 ? "complete" : failed < total ? "partial" : "failed";
    completedAt = new Date();
  }

  await db.update(commands).set({ ackState, status, completedAt }).where(eq(commands.commandId, commandId));
}

/** List recent commands, optionally filtered by target or status. */
export async function listCommands(opts: { limit?: number; targetId?: string; status?: string }) {
  const conditions: SQL<unknown>[] = [];
  if (opts.targetId) conditions.push(or(eq(commands.targetId, opts.targetId), eq(commands.scope, "global"))!);
  if (opts.status) conditions.push(eq(commands.status, opts.status));
  const base = db.select().from(commands);
  const filtered = conditions.length > 0 ? base.where(and(...conditions)) : base;
  return filtered.orderBy(desc(commands.createdAt)).limit(Math.min(opts.limit ?? 50, 200));
}
