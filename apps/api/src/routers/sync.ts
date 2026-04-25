import { router, requireScope, protectedProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { ledZones, rgbPresets, activityLog, stores, syncTransactions } from "@chromacommand/database/schema";
import { eq, desc } from "drizzle-orm";
import { publishCommand } from "../mqtt";
import { broadcast } from "../live";
import { scopeFromRequest } from "../scope";

const transformInput = z.object({
  scope: z.enum(["global", "region", "store"]),
  targetId: z.string(),
  presetId: z.string(),
  effectiveAt: z.string(),
  fadeDurationMs: z.number().min(0).max(30000).default(3000),
  components: z.object({
    rgb: z.boolean().default(true),
    content: z.boolean().default(true),
    audio: z.boolean().default(true),
  }),
});

export const syncRouter = router({
  transform: requireScope<z.infer<typeof transformInput>>((i) => scopeFromRequest(i))
    .input(transformInput)
    .mutation(async ({ input, ctx }) => {
      const [preset] = await db.select().from(rgbPresets).where(eq(rgbPresets.id, input.presetId));
      const colours = (preset?.colours as Record<string, string>) ?? { all: "#1B2A4A" };
      const colourHex = colours.all ?? colours["exterior"] ?? Object.values(colours)[0] ?? "#1B2A4A";

      let allStores = await db.select().from(stores);
      if (input.scope === "store") {
        allStores = allStores.filter((s) => s.id === input.targetId);
      } else if (input.scope === "region") {
        allStores = allStores.filter((s) => s.regionId === input.targetId);
      }

      const commandId = `sync_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // Record the previous preset (best-effort: pick the most-recent
      // sync_transactions row for this target). PRD §21.3.
      const [previous] = await db
        .select()
        .from(syncTransactions)
        .where(eq(syncTransactions.targetId, input.targetId))
        .orderBy(desc(syncTransactions.startedAt))
        .limit(1);

      await db.insert(syncTransactions).values({
        commandId,
        scope: input.scope,
        targetId: input.targetId,
        presetIdBefore: previous?.presetIdAfter ?? null,
        presetIdAfter: input.presetId,
        startedAt: new Date(),
        ackState: { components: input.components, affectedStores: allStores.length },
        initiatedBy: (ctx.user as any)?.id ?? null,
      });

      for (const s of allStores) {
        if (input.components.rgb) {
          await db
            .update(ledZones)
            .set({
              currentColour: colourHex,
              currentMode: preset?.mode ?? "solid",
              lastHeartbeat: new Date(),
            })
            .where(eq(ledZones.storeId, s.id));

          await publishCommand(
            `chromacommand/store/${s.id}/rgb/set/all`,
            { command_id: commandId, colour: colourHex, mode: preset?.mode ?? "solid", fade_ms: input.fadeDurationMs, ts: Date.now() },
            1
          );
        }
        if (input.components.content) {
          await publishCommand(
            `chromacommand/store/${s.id}/content/playlist`,
            { command_id: commandId, preset_id: input.presetId, crossfade: true, ts: Date.now() },
            1
          );
        }
        if (input.components.audio) {
          await publishCommand(
            `chromacommand/store/${s.id}/audio/playlist`,
            { command_id: commandId, preset_id: input.presetId, fade_ms: input.fadeDurationMs, ts: Date.now() },
            1
          );
        }

        broadcast({
          type: "sync_complete",
          storeId: s.id,
          payload: { presetId: input.presetId, components: input.components, colour: colourHex },
        });
      }

      await db.insert(activityLog).values({
        userId: (ctx.user as any)?.id ?? null,
        action: "sync_transform",
        scope: input.scope,
        targetId: input.targetId,
        details: {
          presetId: input.presetId,
          components: input.components,
          affectedStores: allStores.length,
          commandId,
        },
      });

      await db
        .update(syncTransactions)
        .set({ completedAt: new Date() })
        .where(eq(syncTransactions.commandId, commandId));

      return {
        commandId,
        status: "dispatched",
        components: input.components,
        affectedStores: allStores.length,
        estimatedCompleteAt: new Date(Date.now() + input.fadeDurationMs).toISOString(),
      };
    }),

  /** List recent sync transactions for a target (newest first). */
  recent: protectedProcedure
    .input(z.object({ targetId: z.string().optional(), limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      const q = db.select().from(syncTransactions);
      const rows = input.targetId
        ? await q.where(eq(syncTransactions.targetId, input.targetId)).orderBy(desc(syncTransactions.startedAt)).limit(input.limit)
        : await q.orderBy(desc(syncTransactions.startedAt)).limit(input.limit);
      return rows;
    }),

  /**
   * Roll back to the preset that was active before commandId fired.
   * PRD §21.3: operator-driven, not automatic. The new transform creates
   * a new sync_transactions row pointing at presetIdBefore.
   */
  rollback: requireScope<{ commandId: string }>(() => [])
    .input(z.object({ commandId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [tx] = await db
        .select()
        .from(syncTransactions)
        .where(eq(syncTransactions.commandId, input.commandId));

      if (!tx) throw new Error("Sync transaction not found");
      if (!tx.presetIdBefore) {
        throw new Error("No prior preset to roll back to (this was the first sync for this target).");
      }

      // Re-apply the previous preset using the same transform path.
      const [previousPreset] = await db
        .select()
        .from(rgbPresets)
        .where(eq(rgbPresets.id, tx.presetIdBefore));
      if (!previousPreset) throw new Error("Previous preset no longer exists");

      const colours = (previousPreset.colours as Record<string, string>) ?? {};
      const colourHex = colours.all ?? Object.values(colours)[0] ?? "#1B2A4A";

      let allStores = await db.select().from(stores);
      if (tx.scope === "store") allStores = allStores.filter((s) => s.id === tx.targetId);
      else if (tx.scope === "region") allStores = allStores.filter((s) => s.regionId === tx.targetId);

      const newCommandId = `rollback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      for (const s of allStores) {
        await db
          .update(ledZones)
          .set({ currentColour: colourHex, currentMode: previousPreset.mode ?? "solid", lastHeartbeat: new Date() })
          .where(eq(ledZones.storeId, s.id));
        await publishCommand(
          `chromacommand/store/${s.id}/rgb/set/all`,
          { command_id: newCommandId, colour: colourHex, mode: previousPreset.mode ?? "solid", fade_ms: 1500, ts: Date.now() },
          1
        );
        broadcast({
          type: "sync_complete",
          storeId: s.id,
          payload: { presetId: tx.presetIdBefore, components: { rgb: true, content: true, audio: true }, colour: colourHex, rolledBackFrom: input.commandId },
        });
      }

      await db.insert(syncTransactions).values({
        commandId: newCommandId,
        scope: tx.scope,
        targetId: tx.targetId,
        presetIdBefore: tx.presetIdAfter,
        presetIdAfter: tx.presetIdBefore,
        startedAt: new Date(),
        completedAt: new Date(),
        ackState: { rolledBackFrom: input.commandId, affectedStores: allStores.length },
        initiatedBy: (ctx.user as any)?.id ?? null,
      });

      await db.insert(activityLog).values({
        userId: (ctx.user as any)?.id ?? null,
        action: "sync_rollback",
        scope: tx.scope,
        targetId: tx.targetId,
        details: { rolledBackFrom: input.commandId, newCommandId, presetId: tx.presetIdBefore },
      });

      return { commandId: newCommandId, rolledBackFrom: input.commandId, affectedStores: allStores.length };
    }),
});
