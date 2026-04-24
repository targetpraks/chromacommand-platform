import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { ledZones, rgbPresets, activityLog } from "@chromacommand/database/schema";
import { eq, inArray } from "drizzle-orm";

export const rgbRouter = router({
  listPresets: publicProcedure
    .query(async () => {
      const rows = await db.select().from(rgbPresets);
      return rows.map(r => ({
        id: r.id,
        ...r,
      }));
    }),

  getState: publicProcedure
    .input(z.object({ storeId: z.string() }))
    .query(async ({ input }) => {
      const rows = await db.select().from(ledZones).where(eq(ledZones.storeId, input.storeId));
      return {
        storeId: input.storeId,
        zones: rows.map(z => ({
          id: z.id,
          colour: z.currentColour,
          mode: z.currentMode,
          brightness: z.maxBrightness,
          group: z.group,
          status: z.status,
          displayName: z.displayName,
          ledCount: z.ledCount,
        })),
      };
    }),

  multiGetState: publicProcedure
    .input(z.object({ storeIds: z.array(z.string()) }))
    .query(async ({ input }) => {
      const rows = await db.select().from(ledZones).where(inArray(ledZones.storeId, input.storeIds));
      const byStore: Record<string, typeof rows> = {};
      for (const r of rows) {
        if (!byStore[r.storeId]) byStore[r.storeId] = [];
        byStore[r.storeId].push(r);
      }
      return Object.fromEntries(
        input.storeIds.map(id => [id, {
          storeId: id,
          zones: (byStore[id] || []).map(z => ({
            id: z.id,
            colour: z.currentColour,
            mode: z.currentMode,
            brightness: z.maxBrightness,
            group: z.group,
            status: z.status,
            displayName: z.displayName,
            ledCount: z.ledCount,
          })),
        }])
      );
    }),

  set: publicProcedure
    .input(z.any())
    .mutation(async ({ input }) => {
      if (input.zone) {
        await db.update(ledZones).set({
          currentColour: input.colour.primary,
          currentMode: input.colour.mode,
          maxBrightness: input.colour.brightness ?? 1.0,
          lastHeartbeat: new Date(),
        }).where(eq(ledZones.id, input.zone));
      } else {
        await db.update(ledZones).set({
          currentColour: input.colour.primary,
          currentMode: input.colour.mode,
          maxBrightness: input.colour.brightness ?? 1.0,
          lastHeartbeat: new Date(),
        }).where(eq(ledZones.storeId, input.targetId));
      }

      await db.insert(activityLog).values({
        action: "rgb_set",
        scope: input.scope,
        targetId: input.targetId,
        details: { zone: input.zone ?? "all", colour: input.colour.primary, mode: input.colour.mode },
      });

      const commandId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      return {
        commandId,
        status: "dispatched",
        targets: 1,
        estimatedArrivalMs: 150,
        mqttTopic: `chromacommand/store/${input.targetId}/rgb/set/${input.zone ?? "all"}`,
      };
    }),
});
