import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole, requireScope } from "../trpc";
import { db } from "@chromacommand/database";
import { firmwareReleases, firmwareDeployments, stores, activityLog } from "@chromacommand/database/schema";
import { eq, desc } from "drizzle-orm";
import { publishCommand } from "../mqtt";
import { broadcast } from "../live";
import { scopeFromRequest } from "../scope";

const DEVICE_CLASSES = ["led_controller", "screen_player", "audio_player", "gateway"] as const;

export const firmwareRouter = router({
  /** List firmware releases, optionally filtered by device class. */
  listReleases: protectedProcedure
    .input(z.object({ deviceClass: z.enum(DEVICE_CLASSES).optional() }).optional())
    .query(async ({ input }) => {
      const rows = input?.deviceClass
        ? await db
            .select()
            .from(firmwareReleases)
            .where(eq(firmwareReleases.deviceClass, input.deviceClass))
            .orderBy(desc(firmwareReleases.releasedAt))
        : await db.select().from(firmwareReleases).orderBy(desc(firmwareReleases.releasedAt));
      return rows;
    }),

  /** Register a new firmware build. URL must be a signed CDN URL the
   *  edge devices can reach without API auth (e.g. Cloudflare R2 signed). */
  createRelease: requireRole("hq_admin", "technician")
    .input(
      z.object({
        deviceClass: z.enum(DEVICE_CLASSES),
        version: z.string().regex(/^\d+\.\d+\.\d+/, "Must be semver (e.g. 1.2.3)"),
        url: z.string().url(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/i, "Must be lowercase hex SHA-256"),
        sizeBytes: z.number().int().positive().optional(),
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [row] = await db
        .insert(firmwareReleases)
        .values({ ...input, createdBy: (ctx.user as any)?.id ?? null })
        .returning();
      return row;
    }),

  /**
   * Roll out a release to a scope. Publishes an MQTT command to every
   * affected store: chromacommand/store/{id}/firmware/install
   * Devices listen, download from CDN, verify SHA-256, flash, ack with
   * /firmware/state which the edge gateway forwards back.
   */
  deploy: requireScope<{ scope: "store" | "region" | "global"; targetId: string; releaseId: string }>(
    (i) => scopeFromRequest({ scope: i.scope, targetId: i.targetId })
  )
    .input(
      z.object({
        releaseId: z.string().uuid(),
        scope: z.enum(["store", "region", "global"]),
        targetId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [release] = await db.select().from(firmwareReleases).where(eq(firmwareReleases.id, input.releaseId));
      if (!release) throw new TRPCError({ code: "NOT_FOUND", message: "Release not found" });

      let affected = await db.select().from(stores);
      if (input.scope === "store") affected = affected.filter((s) => s.id === input.targetId);
      else if (input.scope === "region") affected = affected.filter((s) => s.regionId === input.targetId);

      const [dep] = await db
        .insert(firmwareDeployments)
        .values({
          releaseId: input.releaseId,
          scope: input.scope,
          targetId: input.targetId,
          totalDevices: affected.length,
          status: "pending",
          initiatedBy: (ctx.user as any)?.id ?? null,
        })
        .returning();

      const commandId = `fw_${Date.now()}_${dep.id.slice(0, 8)}`;
      for (const s of affected) {
        await publishCommand(
          `chromacommand/store/${s.id}/firmware/install`,
          {
            command_id: commandId,
            deployment_id: dep.id,
            device_class: release.deviceClass,
            version: release.version,
            url: release.url,
            sha256: release.sha256,
            size_bytes: release.sizeBytes,
            ts: Date.now(),
          },
          1
        );
        broadcast({
          type: "firmware_deploy",
          storeId: s.id,
          payload: { deploymentId: dep.id, version: release.version, deviceClass: release.deviceClass },
        });
      }

      await db.insert(activityLog).values({
        userId: (ctx.user as any)?.id ?? null,
        action: "firmware_deploy",
        scope: input.scope,
        targetId: input.targetId,
        details: { releaseId: input.releaseId, version: release.version, deviceClass: release.deviceClass, totalDevices: affected.length },
      });

      return { deploymentId: dep.id, commandId, totalDevices: affected.length };
    }),

  /**
   * Edge gateway calls this when a device acks (success/failure) so the
   * deployment tally updates in real-time. Could also come in via MQTT
   * (`firmware/state`) but having an HTTP path makes manual triage easier.
   */
  reportResult: requireRole("technician", "hq_admin")
    .input(
      z.object({
        deploymentId: z.string().uuid(),
        outcome: z.enum(["success", "failed"]),
        deviceId: z.string().optional(),
        error: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [dep] = await db.select().from(firmwareDeployments).where(eq(firmwareDeployments.id, input.deploymentId));
      if (!dep) throw new TRPCError({ code: "NOT_FOUND" });
      const successCount = (dep.successCount ?? 0) + (input.outcome === "success" ? 1 : 0);
      const failureCount = (dep.failureCount ?? 0) + (input.outcome === "failed" ? 1 : 0);
      const total = dep.totalDevices ?? 0;
      let status = dep.status;
      let completedAt = dep.completedAt;
      if (successCount + failureCount >= total) {
        status = failureCount === 0 ? "success" : successCount === 0 ? "failed" : "partial";
        completedAt = new Date();
      }
      await db
        .update(firmwareDeployments)
        .set({ successCount, failureCount, status, completedAt })
        .where(eq(firmwareDeployments.id, input.deploymentId));
      return { successCount, failureCount, status };
    }),

  listDeployments: protectedProcedure
    .input(z.object({ targetId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return input?.targetId
        ? db.select().from(firmwareDeployments).where(eq(firmwareDeployments.targetId, input.targetId)).orderBy(desc(firmwareDeployments.startedAt))
        : db.select().from(firmwareDeployments).orderBy(desc(firmwareDeployments.startedAt));
    }),
});
