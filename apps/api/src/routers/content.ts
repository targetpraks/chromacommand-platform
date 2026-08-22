import { router, protectedProcedure, requireScope, requireRole } from "../trpc";
import { scopeFromRequest } from "../scope";
import { z } from "zod";
import { db } from "@chromacommand/database";
import {
  contentAssets,
  playlists,
  playlistAssignments,
  activityLog,
  screens as screensTable,
} from "@chromacommand/database/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { broadcast } from "../live";
import { dispatchToStores } from "../dispatch";

export const contentRouter = router({
  listAssets: protectedProcedure.query(async () => {
    const rows = await db.select().from(contentAssets).orderBy(desc(contentAssets.createdAt));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      htmlContent: r.htmlContent,
      css: r.css,
      dimensions: r.dimensions,
      durationSeconds: r.durationSeconds,
      priority: r.priority,
      tags: r.tags,
      validFrom: r.validFrom?.toISOString() ?? null,
      validUntil: r.validUntil?.toISOString() ?? null,
      updated: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—",
    }));
  }),

  getAsset: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const [row] = await db.select().from(contentAssets).where(eq(contentAssets.id, input.id)).limit(1);
      if (!row) throw new Error("Asset not found");
      return row;
    }),

  createAsset: requireRole("hq_admin", "regional_manager")
    .input(
      z.object({
        name: z.string().min(1).max(128),
        type: z.enum(["html", "image", "video", "template"]),
        htmlContent: z.string().max(100_000).optional(),
        css: z.string().max(50_000).optional(),
        imageUrl: z.string().url().optional(),
        dimensions: z.object({ width: z.number(), height: z.number() }).optional(),
        durationSeconds: z.number().min(1).max(3600).default(15),
        priority: z.number().default(100),
        tags: z.array(z.string()).default([]),
        validFrom: z.string().optional(),
        validUntil: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const html =
        input.type === "image" && input.imageUrl
          ? `<img src="${input.imageUrl}" style="width:100%;height:100%;object-fit:cover" />`
          : input.htmlContent;
      const [row] = await db
        .insert(contentAssets)
        .values({
          name: input.name,
          type: input.type,
          htmlContent: html,
          css: input.css,
          dimensions: input.dimensions,
          durationSeconds: input.durationSeconds,
          priority: input.priority,
          tags: input.tags,
          orgId: ctx.user?.orgId ?? null,
          createdBy: ctx.user?.id ?? null,
          validFrom: input.validFrom ? new Date(input.validFrom) : null,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
        })
        .returning();

      await db.insert(activityLog).values({
        userId: ctx.user?.id ?? null,
        action: "content_create",
        scope: "global",
        targetId: row.id,
        details: { name: input.name, type: input.type },
      });
      return { assetId: row.id, status: "created" };
    }),

  deleteAsset: requireRole("hq_admin", "regional_manager")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.delete(contentAssets).where(eq(contentAssets.id, input.id));
      return { id: input.id, status: "deleted" };
    }),

  listPlaylists: protectedProcedure.query(async () => {
    return db.select().from(playlists).orderBy(desc(playlists.createdAt));
  }),

  /** Build/replace a playlist from ordered asset ids. */
  savePlaylist: requireRole("hq_admin", "regional_manager")
    .input(
      z.object({
        playlistId: z.string().optional(),
        name: z.string().min(1).max(128),
        items: z.array(z.object({ assetId: z.string(), durationSeconds: z.number().min(1).default(15) })).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const loopDuration = input.items.reduce((sum, i) => sum + i.durationSeconds, 0);
      if (input.playlistId) {
        await db
          .update(playlists)
          .set({ name: input.name, items: input.items, loopDuration })
          .where(eq(playlists.id, input.playlistId));
        return { id: input.playlistId, status: "updated" };
      }
      const [row] = await db
        .insert(playlists)
        .values({ name: input.name, items: input.items, loopDuration, createdBy: ctx.user?.id ?? null })
        .returning();
      return { id: row.id, status: "created" };
    }),

  /**
   * Assign a playlist to a scope or explicit screens. Explicit screenIds win;
   * otherwise every store under the scope gets an assignment row and the
   * playlist is pushed live.
   */
  assignPlaylist: requireScope<{ scope: string; targetId?: string }>((i) =>
    i.scope === "store" ? [`store:${i.targetId}`] : []
  )
    .input(
      z.object({
        playlistId: z.string(),
        scope: z.enum(["global", "country", "province", "region", "city", "store"]),
        targetId: z.string(),
        screenIds: z.array(z.string()).optional(),
        active: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Deactivate prior assignments for these screens first, then add the new one.
      if (input.screenIds && input.screenIds.length > 0) {
        await db
          .update(playlistAssignments)
          .set({ active: false })
          .where(inArray(playlistAssignments.screenId, input.screenIds));
        for (const screenId of input.screenIds) {
          await db.insert(playlistAssignments).values({
            playlistId: input.playlistId,
            screenId,
            scope: "store",
            targetId: screenId.split("-")[0],
            priority: 200,
            active: input.active,
            assignedBy: ctx.user?.id ?? null,
          });
        }
      } else {
        await db.insert(playlistAssignments).values({
          playlistId: input.playlistId,
          scope: input.scope,
          targetId: input.targetId,
          active: input.active,
          assignedBy: ctx.user?.id ?? null,
        });
      }

      const { commandId, storeIds } = await dispatchToStores({
        kind: "content.assign",
        scope: input.scope,
        targetId: input.targetId,
        payload: { playlist_id: input.playlistId },
        build: (storeId) => ({
          topic: `chromacommand/store/${storeId}/content/playlist`,
          body: {},
        }),
        userId: ctx.user?.id,
      });

      await db.insert(activityLog).values({
        userId: ctx.user?.id ?? null,
        action: "content_assign",
        scope: input.scope,
        targetId: input.targetId,
        details: { playlistId: input.playlistId, screens: input.screenIds ?? "all", stores: storeIds.length, commandId },
      });

      for (const storeId of storeIds) {
        broadcast({ type: "content_update", storeId, payload: { playlistId: input.playlistId, commandId } });
      }

      return { commandId, status: "assigned", stores: storeIds.length };
    }),

  /** Push a single asset full-screen (promo/takeover burst). */
  pushAsset: requireScope<{ scope: string; targetId?: string }>((i) =>
    i.scope === "store" ? [`store:${i.targetId}`] : []
  )
    .input(
      z.object({
        scope: z.enum(["global", "country", "province", "region", "city", "store"]),
        targetId: z.string(),
        assetId: z.string(),
        durationSeconds: z.number().min(1).max(86400).default(60),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { commandId, storeIds } = await dispatchToStores({
        kind: "content.push",
        scope: input.scope,
        targetId: input.targetId,
        payload: { cmd: "push_asset", asset_id: input.assetId, duration_seconds: input.durationSeconds },
        build: (storeId) => ({
          topic: `chromacommand/store/${storeId}/content/command`,
          body: {},
        }),
        userId: ctx.user?.id,
      });
      return { commandId, targets: storeIds.length };
    }),

  /** Emergency message on every kiosk in scope — overrides playlists immediately. */
  emergencyMessage: requireRole("hq_admin", "regional_manager")
    .input(
      z.object({
        scope: z.enum(["global", "country", "province", "region", "city", "store"]),
        targetId: z.string(),
        heading: z.string().min(1).max(120),
        body: z.string().max(500).optional(),
        backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#C62828"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { commandId, storeIds } = await dispatchToStores({
        kind: "screen.emergency",
        scope: input.scope,
        targetId: input.targetId,
        payload: {
          cmd: "show_emergency",
          heading: input.heading,
          body: input.body,
          background_color: input.backgroundColor,
        },
        build: (storeId) => ({
          topic: `chromacommand/store/${storeId}/content/command`,
          body: {},
        }),
        userId: ctx.user?.id,
      });

      await db.insert(activityLog).values({
        userId: ctx.user?.id ?? null,
        action: "screen_emergency",
        scope: input.scope,
        targetId: input.targetId,
        details: { heading: input.heading, stores: storeIds.length, commandId },
      });
      return { commandId, targets: storeIds.length };
    }),

  /** Clear any emergency overlay / pushed asset and resume playlists. */
  clearOverlays: requireRole("hq_admin", "regional_manager")
    .input(
      z.object({
        scope: z.enum(["global", "country", "province", "region", "city", "store"]),
        targetId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { commandId, storeIds } = await dispatchToStores({
        kind: "screen.clear",
        scope: input.scope,
        targetId: input.targetId,
        payload: { cmd: "clear_overlay" },
        build: (storeId) => ({
          topic: `chromacommand/store/${storeId}/content/command`,
          body: {},
        }),
        userId: ctx.user?.id,
      });
      return { commandId, targets: storeIds.length };
    }),

  /** Device-level kiosk commands. */
  screenCommand: requireRole("hq_admin", "regional_manager", "technician")
    .input(
      z.object({
        screenId: z.string(),
        command: z.enum(["reload", "set_brightness", "reboot", "screenshot"]),
        brightness: z.number().min(10).max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [screen] = await db.select().from(screensTable).where(eq(screensTable.id, input.screenId)).limit(1);
      if (!screen) throw new Error("Screen not found");

      const { commandId } = await dispatchToStores({
        kind: "screen.command",
        scope: "store",
        targetId: screen.storeId,
        payload: { cmd: input.command, brightness: input.brightness, screen_id: input.screenId },
        build: () => ({
          topic: `chromacommand/store/${screen.storeId}/content/command`,
          body: { screen_ids: [input.screenId] },
        }),
        userId: ctx.user?.id,
      });

      await db.insert(activityLog).values({
        userId: ctx.user?.id ?? null,
        action: "screen_command",
        scope: "store",
        targetId: screen.storeId,
        details: { screenId: input.screenId, command: input.command, commandId },
      });
      return { commandId };
    }),

  storeScreens: protectedProcedure
    .input(z.object({ storeId: z.string() }))
    .query(async ({ input }) => {
      return db.select().from(screensTable).where(eq(screensTable.storeId, input.storeId));
    }),
});
