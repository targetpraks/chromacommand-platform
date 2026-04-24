import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { contentAssets, playlists, playlistAssignments, activityLog, stores, screens as screensTable } from "@chromacommand/database/schema";
import { eq, desc } from "drizzle-orm";

export const contentRouter = router({
  listAssets: publicProcedure
    .query(async () => {
      const rows = await db.select().from(contentAssets).orderBy(desc(contentAssets.createdAt));
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        htmlContent: r.htmlContent,
        css: r.css,
        dimensions: r.dimensions,
        durationSeconds: r.durationSeconds,
        priority: r.priority,
        tags: r.tags,
        updated: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—",
        size: "—",
      }));
    }),

  createAsset: publicProcedure
    .input(z.object({
      name: z.string(),
      type: z.enum(["html", "image", "video", "template"]),
      htmlContent: z.string().optional(),
      css: z.string().optional(),
      dimensions: z.object({ width: z.number(), height: z.number() }).optional(),
      durationSeconds: z.number().min(1).default(15),
      priority: z.number().default(100),
      tags: z.array(z.string()).default([]),
      validFrom: z.string().optional(),
      validUntil: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [row] = await db.insert(contentAssets).values({
        name: input.name,
        type: input.type,
        htmlContent: input.htmlContent,
        css: input.css,
        dimensions: input.dimensions,
        durationSeconds: input.durationSeconds,
        priority: input.priority,
        tags: input.tags,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
      }).returning();

      await db.insert(activityLog).values({
        action: "content_create",
        scope: "global",
        targetId: row.id,
        details: { name: input.name, type: input.type },
      });

      return { assetId: row.id, status: "created" };
    }),

  listPlaylists: publicProcedure
    .query(async () => {
      return db.select().from(playlists).orderBy(desc(playlists.createdAt));
    }),

  assignPlaylist: publicProcedure
    .input(z.object({
      playlistId: z.string(),
      scope: z.enum(["store", "region", "global"]),
      targetId: z.string(),
      screenIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      await db.insert(playlistAssignments).values({
        playlistId: input.playlistId,
        scope: input.scope,
        targetId: input.targetId,
      });
      return { status: "assigned", scope: input.scope, targetId: input.targetId };
    }),

  storeScreens: publicProcedure
    .input(z.object({ storeId: z.string() }))
    .query(async ({ input }) => {
      const rows = await db.select().from(screensTable).where(eq(screensTable.storeId, input.storeId));
      return rows;
    }),
});
