import { router, protectedProcedure, requireScope, requireRole } from "../trpc";
import { scopeFromRequest } from "../scope";
import { resolveStoreTargets } from "../targets";
import { z } from "zod";
import { db } from "@chromacommand/database";
import {
  scenes,
  rgbPresets,
  ledZones,
  activityLog,
  syncTransactions,
} from "@chromacommand/database/schema";
import { eq, desc } from "drizzle-orm";
import { broadcast } from "../live";
import { dispatchToStores } from "../dispatch";

/**
 * Scenes — one button applies lighting + content + audio together across any
 * scope. This is the intelligence layer on top of the individual component
 * routers: a scene bundles preset/playlist/volume into one TakeOver.
 */
export const scenesRouter = router({
  list: protectedProcedure.query(async () => {
    return db.select().from(scenes).orderBy(desc(scenes.createdAt));
  }),

  save: requireRole("hq_admin", "regional_manager")
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(64),
        description: z.string().max(512).optional(),
        presetId: z.string(),
        contentPlaylistId: z.string().optional(),
        audioPlaylistId: z.string().optional(),
        audioVolume: z.number().min(0).max(1).optional(),
        transitionMs: z.number().min(0).max(30000).default(3000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.id) {
        await db.update(scenes).set(input).where(eq(scenes.id, input.id));
        return { id: input.id, status: "updated" };
      }
      const [row] = await db.insert(scenes).values({ ...input, isGlobal: true }).returning();
      await db.insert(activityLog).values({
        userId: ctx.user?.id ?? null,
        action: "scene_save",
        scope: "global",
        targetId: row.id,
        details: { name: input.name },
      });
      return { id: row.id, status: "created" };
    }),

  delete: requireRole("hq_admin")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.delete(scenes).where(eq(scenes.id, input.id));
      return { id: input.id, status: "deleted" };
    }),

  /**
   * Trigger a scene on a scope. Fan-out covers RGB + content + audio in one
   * pass; every store gets all three component commands.
   */
  trigger: requireScope<{ sceneId?: string }>(() => [])
    .input(
      z.object({
        sceneId: z.string(),
        scope: z.enum(["global", "country", "province", "region", "city", "store"]),
        targetId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [scene] = await db.select().from(scenes).where(eq(scenes.id, input.sceneId)).limit(1);
      if (!scene) throw new Error("Scene not found");
      if (!scene.presetId) throw new Error("Scene has no lighting preset configured");
      const [preset] = await db.select().from(rgbPresets).where(eq(rgbPresets.id, scene.presetId)).limit(1);

      const colours = (preset?.colours as Record<string, string>) ?? {};
      const colourHex = colours.all ?? Object.values(colours)[0] ?? "#1B2A4A";
      const commandIdBase = `scene_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

      // ── RGB component ──
      await dispatchToStores({
        kind: "scene.rgb",
        scope: input.scope,
        targetId: input.targetId,
        payload: {
          colour: colourHex,
          mode: preset?.mode ?? "solid",
          brightness: preset?.brightness ?? 1,
          speed: preset?.speed ?? 1,
          fade_ms: scene.transitionMs ?? 3000,
          scene_id: scene.id,
          scene_command: commandIdBase,
        },
        build: (storeId) => ({
          topic: `chromacommand/store/${storeId}/rgb/set/all`,
          body: {},
        }),
        userId: ctx.user?.id,
      });

      // ── Content component ──
      let contentDispatched = false;
      if (scene.contentPlaylistId) {
        await dispatchToStores({
          kind: "scene.content",
          scope: input.scope,
          targetId: input.targetId,
          payload: { playlist_id: scene.contentPlaylistId, crossfade: true, scene_command: commandIdBase },
          build: (storeId) => ({
            topic: `chromacommand/store/${storeId}/content/playlist`,
            body: {},
          }),
          userId: ctx.user?.id,
        });
        contentDispatched = true;
      }

      // ── Audio component ──
      let audioDispatched = false;
      if (scene.audioPlaylistId) {
        await dispatchToStores({
          kind: "scene.audio",
          scope: input.scope,
          targetId: input.targetId,
          payload: {
            action: "play",
            zone: "dining",
            playlist_id: scene.audioPlaylistId,
            volume: scene.audioVolume ?? undefined,
            fade_ms: scene.transitionMs ?? 3000,
            source: "local",
            scene_command: commandIdBase,
          },
          build: (storeId) => ({
            topic: `chromacommand/store/${storeId}/audio/set/dining`,
            body: {},
          }),
          userId: ctx.user?.id,
        });
        audioDispatched = true;
      }

      // Ledger row so the sync timeline + rollback see scenes too.
      await db.insert(syncTransactions).values({
        commandId: commandIdBase,
        scope: input.scope,
        targetId: input.targetId,
        presetIdAfter: scene.presetId,
        startedAt: new Date(),
        completedAt: new Date(),
        ackState: { sceneId: scene.id, components: { rgb: true, content: contentDispatched, audio: audioDispatched } },
        initiatedBy: ctx.user?.id ?? null,
      });

      await db.insert(activityLog).values({
        userId: ctx.user?.id ?? null,
        action: "scene_apply",
        scope: input.scope,
        targetId: input.targetId,
        details: { sceneId: scene.id, name: scene.name, commandId: commandIdBase },
      });

      const resolved = await resolveStoreTargets({ scope: input.scope, targetId: input.targetId });
      for (const storeId of resolved.storeIds) {
        broadcast({ type: "sync_complete", storeId, payload: { sceneId: scene.id, name: scene.name, colour: colourHex } });
        await db.update(ledZones).set({ currentColour: colourHex, currentMode: preset?.mode ?? "solid" }).where(eq(ledZones.storeId, storeId));
      }

      return {
        commandId: commandIdBase,
        sceneName: scene.name,
        components: { rgb: true, content: contentDispatched, audio: audioDispatched },
        targets: resolved.storeIds.length,
      };
    }),
});
