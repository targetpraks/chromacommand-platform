import { router, protectedProcedure, requireScope, requireRole } from "../trpc";
import { scopeFromRequest } from "../scope";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { ledZones, rgbPresets, activityLog } from "@chromacommand/database/schema";
import { eq, inArray } from "drizzle-orm";
import { broadcast } from "../live";
import { dispatchToStores } from "../dispatch";

export const RGB_MODES = ["solid", "gradient", "pulse", "chase", "breath", "sparkle", "wave", "rainbow"] as const;

const setInput = z.object({
  scope: z.enum(["global", "country", "province", "region", "city", "store"]),
  targetId: z.string(),
  zone: z.string().optional(),
  colour: z.object({
    mode: z.enum(RGB_MODES).default("solid"),
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    brightness: z.number().min(0).max(1).default(1.0),
    speed: z.number().min(0).max(10).default(1.0),
  }),
  /** Optional per-segment overrides: [{ name, startIndex, endIndex, primary }] */
  segments: z
    .array(
      z.object({
        name: z.string().optional(),
        startIndex: z.number().int().min(0),
        endIndex: z.number().int().min(0),
        primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        mode: z.enum(RGB_MODES).optional(),
      })
    )
    .max(16)
    .optional(),
  fadeMs: z.number().min(0).max(30000).default(0),
});

async function applyZonesState(
  storeIds: string[],
  zone: string | undefined,
  set: { currentColour: string; currentMode: string; maxBrightness: number }
) {
  if (zone) {
    await db.update(ledZones).set({ ...set, lastHeartbeat: new Date() }).where(eq(ledZones.id, zone));
    return;
  }
  for (const storeId of storeIds) {
    await db.update(ledZones).set({ ...set, lastHeartbeat: new Date() }).where(eq(ledZones.storeId, storeId));
  }
}

export const rgbRouter = router({
  listPresets: protectedProcedure.query(async () => {
    return db.select().from(rgbPresets);
  }),

  createPreset: requireRole("hq_admin", "regional_manager")
    .input(
      z.object({
        name: z.string().min(1).max(64),
        description: z.string().max(512).optional(),
        colours: z.record(z.string()),
        mode: z.enum(RGB_MODES).default("solid"),
        brightness: z.number().min(0).max(1).default(1.0),
        speed: z.number().min(0).max(10).default(1.0),
      })
    )
    .mutation(async ({ input }) => {
      const [row] = await db.insert(rgbPresets).values({ ...input, isGlobal: true }).returning();
      return { id: row.id, status: "created" };
    }),

  deletePreset: requireRole("hq_admin")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.delete(rgbPresets).where(eq(rgbPresets.id, input.id));
      return { id: input.id, status: "deleted" };
    }),

  listModes: protectedProcedure.query(() => ({ modes: RGB_MODES })),

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
          segments: (z.segments as any[]) ?? [],
        })),
      };
    }),

  multiGetState: protectedProcedure
    .input(z.object({ storeIds: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.storeIds.length === 0) return {};
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
              segments: (z.segments as any[]) ?? [],
            })),
          },
        ])
      );
    }),

  set: requireScope<z.infer<typeof setInput>>((i) =>
    i.scope === "store" ? [`store:${i.targetId}`] : []
  )
    .input(setInput)
    .mutation(async ({ input, ctx }) => {
      const set = {
        currentColour: input.colour.primary,
        currentMode: input.colour.mode,
        maxBrightness: input.colour.brightness,
      };

      const { commandId, storeIds } = await dispatchToStores({
        kind: "rgb.set",
        scope: input.scope,
        targetId: input.targetId,
        payload: {
          colour: input.colour.primary,
          secondary: input.colour.secondary,
          mode: input.colour.mode,
          brightness: input.colour.brightness,
          speed: input.colour.speed,
          fade_ms: input.fadeMs,
          ...(input.segments ? { segments: input.segments } : {}),
        },
        build: (storeId) => ({
          topic: `chromacommand/store/${storeId}/rgb/set/${input.zone ?? "all"}`,
          body: {},
        }),
        userId: ctx.user?.id,
      });

      await applyZonesState(storeIds, input.zone, set);

      await db.insert(activityLog).values({
        userId: ctx.user?.id ?? null,
        action: "rgb_set",
        scope: input.scope,
        targetId: input.targetId,
        details: {
          zone: input.zone ?? "all",
          colour: input.colour.primary,
          mode: input.colour.mode,
          brightness: input.colour.brightness,
          stores: storeIds.length,
          commandId,
        },
      });

      for (const storeId of storeIds) {
        broadcast({
          type: "rgb_update",
          storeId,
          payload: {
            zone: input.zone ?? "all",
            colour: input.colour.primary,
            mode: input.colour.mode,
            brightness: input.colour.brightness,
            commandId,
          },
        });
      }

      return {
        commandId,
        status: "dispatched",
        targets: storeIds.length,
        estimatedArrivalMs: 150 + Math.min(storeIds.length * 20, 2000),
      };
    }),

  /** All zones off across a scope. */
  blackout: requireScope<{ scope: string; targetId: string }>((i) =>
    i.scope === "store" ? [`store:${i.targetId}`] : []
  )
    .input(z.object({ scope: z.enum(["global", "country", "province", "region", "city", "store"]), targetId: z.string(), fadeMs: z.number().min(0).max(10000).default(1000) }))
    .mutation(async ({ input, ctx }) => {
      const { commandId, storeIds } = await dispatchToStores({
        kind: "rgb.blackout",
        scope: input.scope,
        targetId: input.targetId,
        payload: { colour: "#000000", mode: "solid", brightness: 0, speed: 1, fade_ms: input.fadeMs },
        build: (storeId) => ({
          topic: `chromacommand/store/${storeId}/rgb/set/all`,
          body: {},
        }),
        userId: ctx.user?.id,
      });

      for (const storeId of storeIds) {
        await db.update(ledZones).set({ currentColour: "#000000", currentMode: "solid", maxBrightness: 0 }).where(eq(ledZones.storeId, storeId));
        broadcast({ type: "rgb_update", storeId, payload: { zone: "all", colour: "#000000", mode: "off", commandId } });
      }
      await db.insert(activityLog).values({
        userId: ctx.user?.id ?? null,
        action: "rgb_blackout",
        scope: input.scope,
        targetId: input.targetId,
        details: { stores: storeIds.length, commandId },
      });
      return { commandId, targets: storeIds.length };
    }),

  /** Flash one zone white so techs can find it on-site. */
  identify: requireScope<{ zoneId: string }>(() => [])
    .input(z.object({ zoneId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [zone] = await db.select().from(ledZones).where(eq(ledZones.id, input.zoneId)).limit(1);
      if (!zone) throw new Error("Zone not found");

      const { commandId } = await dispatchToStores({
        kind: "rgb.identify",
        scope: "store",
        targetId: zone.storeId,
        payload: { colour: "#FFFFFF", mode: "sparkle", brightness: 1, speed: 4, fade_ms: 0, identify_seconds: 5 },
        build: () => ({
          topic: `chromacommand/store/${zone.storeId}/rgb/set/${zone.id}`,
          body: {},
        }),
        userId: ctx.user?.id,
      });

      broadcast({ type: "rgb_update", storeId: zone.storeId, payload: { zone: zone.id, mode: "identify", commandId } });
      return { commandId };
    }),
});
