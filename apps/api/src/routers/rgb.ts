import { router, protectedProcedure, requireScope } from "../trpc";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { ledZones, rgbPresets, activityLog } from "@chromacommand/database/schema";
import { eq, inArray } from "drizzle-orm";
import { publishCommand } from "../mqtt";
import { broadcast } from "../live";
import { scopeFromRequest } from "../scope";

const setInput = z.object({
  scope: z.enum(["global", "region", "store", "zone"]),
  targetId: z.string(),
  zone: z.string().optional(),
  colour: z.object({
    mode: z.string().default("solid"),
    primary: z.string(),
    secondary: z.string().optional(),
    brightness: z.number().min(0).max(1).default(1.0),
    speed: z.number().min(0).default(1.0),
  }),
  fadeMs: z.number().min(0).max(30000).default(0),
});

export const rgbRouter = router({
  listPresets: protectedProcedure.query(async () => {
    const rows = await db.select().from(rgbPresets);
    return rows.map((r) => ({ ...r }));
  }),

  getState: protectedProcedure
    .input(z.object({ storeId: z.string() }))
    .query(async ({ input }) => {
      const rows = await db.select().from(ledZones).where(eq(ledZones.storeId, input.storeId));
      return {
        storeId: input.storeId,
        zones: rows.map((z) => ({
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

  multiGetState: protectedProcedure
    .input(z.object({ storeIds: z.array(z.string()) }))
    .query(async ({ input }) => {
      const rows = await db.select().from(ledZones).where(inArray(ledZones.storeId, input.storeIds));
      const byStore: Record<string, typeof rows> = {};
      for (const r of rows) {
        if (!byStore[r.storeId]) byStore[r.storeId] = [];
        byStore[r.storeId].push(r);
      }
      return Object.fromEntries(
        input.storeIds.map((id) => [
          id,
          {
            storeId: id,
            zones: (byStore[id] || []).map((z) => ({
              id: z.id,
              colour: z.currentColour,
              mode: z.currentMode,
              brightness: z.maxBrightness,
              group: z.group,
              status: z.status,
              displayName: z.displayName,
              ledCount: z.ledCount,
            })),
          },
        ])
      );
    }),

  set: requireScope<z.infer<typeof setInput>>((i) =>
    scopeFromRequest({ scope: i.scope === "zone" ? "store" : i.scope, targetId: i.targetId })
  )
    .input(setInput)
    .mutation(async ({ input, ctx }) => {
      if (input.zone) {
        await db
          .update(ledZones)
          .set({
            currentColour: input.colour.primary,
            currentMode: input.colour.mode,
            maxBrightness: input.colour.brightness,
            lastHeartbeat: new Date(),
          })
          .where(eq(ledZones.id, input.zone));
      } else {
        await db
          .update(ledZones)
          .set({
            currentColour: input.colour.primary,
            currentMode: input.colour.mode,
            maxBrightness: input.colour.brightness,
            lastHeartbeat: new Date(),
          })
          .where(eq(ledZones.storeId, input.targetId));
      }

      await db.insert(activityLog).values({
        userId: (ctx.user as any)?.id ?? null,
        action: "rgb_set",
        scope: input.scope,
        targetId: input.targetId,
        details: {
          zone: input.zone ?? "all",
          colour: input.colour.primary,
          mode: input.colour.mode,
          brightness: input.colour.brightness,
        },
      });

      const commandId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const topic = `chromacommand/store/${input.targetId}/rgb/set/${input.zone ?? "all"}`;
      const payload = {
        command_id: commandId,
        colour: input.colour.primary,
        mode: input.colour.mode,
        brightness: input.colour.brightness,
        speed: input.colour.speed,
        fade_ms: input.fadeMs,
        ts: Date.now(),
      };

      await publishCommand(topic, payload, 1);

      broadcast({
        type: "rgb_update",
        storeId: input.targetId,
        payload: { zone: input.zone ?? "all", colour: input.colour.primary, mode: input.colour.mode },
      });

      return {
        commandId,
        status: "dispatched",
        targets: 1,
        estimatedArrivalMs: 150,
        mqttTopic: topic,
      };
    }),
});
