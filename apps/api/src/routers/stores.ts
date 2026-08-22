import { router, protectedProcedure, requireScope, requireRole } from "../trpc";
import { scopeFromRequest } from "../scope";
import { z } from "zod";
import { db } from "@chromacommand/database";
import {
  stores,
  ledZones,
  screens,
  audioZones,
  devices,
  cities,
} from "@chromacommand/database/schema";
import { eq } from "drizzle-orm";

const geoFields = {
  countryId: z.string().max(32).optional(),
  provinceId: z.string().max(32).optional(),
  cityId: z.string().max(32).optional(),
};

const segmentSchema = z.object({
  name: z.string().min(1).max(48),
  startIndex: z.number().int().min(0),
  endIndex: z.number().int().min(0),
});

export const storesRouter = router({
  list: protectedProcedure
    .input(z.object({ regionId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const rows = await db.select().from(stores)
        .where(input?.regionId ? eq(stores.regionId, input.regionId) : undefined);

      const result: any[] = [];
      for (const store of rows) {
        const [zoneRows, screenRows, audioRows] = await Promise.all([
          db.select().from(ledZones).where(eq(ledZones.storeId, store.id)),
          db.select().from(screens).where(eq(screens.storeId, store.id)),
          db.select().from(audioZones).where(eq(audioZones.storeId, store.id)),
        ]);
        const [cityRow] = store.cityId
          ? await db.select().from(cities).where(eq(cities.id, store.cityId)).limit(1)
          : [];

        result.push({
          id: store.id,
          name: store.name,
          region: cityRow?.name ?? store.regionId,
          countryId: store.countryId,
          provinceId: store.provinceId,
          cityId: store.cityId ?? store.regionId,
          status: store.status === "active" ? "online" : "offline",
          zones: zoneRows.map((z) => ({
            id: z.id,
            colour: z.currentColour ?? "#1B2A4A",
            mode: z.currentMode ?? "solid",
            brightness: z.maxBrightness ?? 0.85,
          })),
          screens: screenRows.length,
          activeContent: screenRows.some((s) => s.status === "online") ? "Standard Menu" : "No Signal",
          lastHeartbeat: audioRows.length > 0 ? "2s ago" : "—",
          audioZone: audioRows.find((a) => a.status === "online")?.sinkName ?? "—",
        });
      }
      return result;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const [store] = await db.select().from(stores).where(eq(stores.id, input.id));
      if (!store) throw new Error("Store not found");

      const [zoneRows, screenRows, audioRows, deviceRows] = await Promise.all([
        db.select().from(ledZones).where(eq(ledZones.storeId, store.id)),
        db.select().from(screens).where(eq(screens.storeId, store.id)),
        db.select().from(audioZones).where(eq(audioZones.storeId, store.id)),
        db.select().from(devices).where(eq(devices.storeId, store.id)),
      ]);
      const [cityRow] = store.cityId
        ? await db.select().from(cities).where(eq(cities.id, store.cityId)).limit(1)
        : [];

      return {
        id: store.id,
        name: store.name,
        region: cityRow?.name ?? store.regionId,
        address: store.address ?? "",
        countryId: store.countryId,
        provinceId: store.provinceId,
        cityId: store.cityId ?? store.regionId,
        status: store.status === "active" ? "online" : "offline",
        lastHeartbeat: deviceRows
          .filter((d) => d.deviceType === "gateway" && d.lastSeen)
          .map((d) => d.lastSeen!.toISOString())[0] ?? null,
        zones: zoneRows.map((z) => ({
          id: z.id,
          displayName: z.displayName,
          group: z.group,
          currentColour: z.currentColour ?? "#1B2A4A",
          colour: z.currentColour ?? "#1B2A4A",
          currentMode: z.currentMode ?? "solid",
          mode: z.currentMode ?? "solid",
          brightness: z.maxBrightness ?? 0.85,
          maxBrightness: z.maxBrightness ?? 0.85,
          ledCount: z.ledCount ?? 0,
          segments: (z.segments as any[]) ?? [],
          status: z.status === "online" ? "online" : "offline",
        })),
        screens: screenRows.map((s) => ({
          id: s.id,
          type: s.screenType,
          model: s.hardwareType ?? "Unknown",
          hardwareType: s.hardwareType ?? "Unknown",
          status: s.status === "online" ? "online" : "offline",
          lastHeartbeat: s.lastHeartbeat?.toISOString() ?? null,
          currentAsset: "Standard Menu",
        })),
        audioZones: audioRows.map((a) => ({
          id: a.id,
          zoneType: a.zoneType,
          zone: a.zoneType,
          sinkName: a.sinkName,
          volume: a.volume ?? 0.45,
          status: a.status === "online" ? "playing" : "stopped",
        })),
        devices: deviceRows.map((d) => ({
          id: d.id,
          deviceType: d.deviceType,
          label: d.label ?? d.id,
          entityRef: d.entityRef,
          firmwareVersion: d.firmwareVersion,
          status: d.status,
          lastSeen: d.lastSeen?.toISOString() ?? null,
        })),
      };
    }),

  create: requireRole("hq_admin", "regional_manager")
    .input(
      z.object({
        id: z.string().min(2).max(32).regex(/^[a-z0-9-]+$/),
        name: z.string().min(1).max(128),
        regionId: z.string().min(1).max(32),
        ...geoFields,
        address: z.string().max(512).optional(),
        lat: z.number().optional(),
        lon: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.insert(stores).values({ status: "setup", ...input }).onConflictDoNothing();
      await db.insert(devices).values({
        id: `gateway-${input.id}`,
        storeId: input.id,
        deviceType: "gateway",
        label: "Edge Gateway",
        status: "offline",
      });
      return { id: input.id, status: "created" };
    }),

  update: requireRole("hq_admin", "regional_manager")
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(128).optional(),
        address: z.string().max(512).optional(),
        lat: z.number().optional(),
        lon: z.number().optional(),
        status: z.enum(["setup", "active", "paused", "offline"]).optional(),
        ...geoFields,
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...set } = input;
      if (Object.keys(set).length > 0) {
        await db.update(stores).set(set).where(eq(stores.id, id));
      }
      return { id, status: "updated" };
    }),

  remove: requireRole("hq_admin")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.delete(ledZones).where(eq(ledZones.storeId, input.id));
      await db.delete(screens).where(eq(screens.storeId, input.id));
      await db.delete(audioZones).where(eq(audioZones.storeId, input.id));
      await db.delete(devices).where(eq(devices.storeId, input.id));
      await db.delete(stores).where(eq(stores.id, input.id));
      return { id: input.id, status: "deleted" };
    }),

  addZone: requireScope<{ storeId: string }>((i) => scopeFromRequest({ scope: "store", targetId: i.storeId }))
    .input(
      z.object({
        storeId: z.string(),
        zoneId: z.string().min(1).max(64),
        displayName: z.string().min(1).max(128),
        group: z.enum(["ambient", "decorative", "service", "furniture", "exterior"]),
        controllerMac: z.string().length(17),
        ledCount: z.number().int().min(1).max(2000),
        ledType: z.enum(["WS2812B", "APA102", "SK6812"]).default("WS2812B"),
        voltage: z.number().min(3.3).max(24).default(5),
        segments: z.array(segmentSchema).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = `${input.storeId}-${input.zoneId}`;
      await db
        .insert(ledZones)
        .values({
          id,
          storeId: input.storeId,
          displayName: input.displayName,
          group: input.group,
          controllerMac: input.controllerMac,
          ledCount: input.ledCount,
          ledType: input.ledType,
          voltage: input.voltage,
          segments: input.segments ?? [],
          status: "setup",
        })
        .onConflictDoNothing();
      await db.insert(devices).values({
        id: `${id}-led`,
        storeId: input.storeId,
        deviceType: "led_controller",
        label: `${input.displayName} Controller`,
        entityRef: id,
        status: "offline",
      });
      return { id, status: "created" };
    }),

  updateZone: requireScope<{ zoneId: string }>(() => [])
    .input(
      z.object({
        zoneId: z.string(),
        displayName: z.string().min(1).max(128).optional(),
        ledCount: z.number().int().min(1).max(2000).optional(),
        segments: z.array(segmentSchema).optional(),
        maxBrightness: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { zoneId, ...set } = input;
      if (Object.keys(set).length > 0) {
        await db.update(ledZones).set(set).where(eq(ledZones.id, zoneId));
      }
      return { id: zoneId, status: "updated" };
    }),

  removeZone: requireRole("hq_admin", "regional_manager")
    .input(z.object({ zoneId: z.string() }))
    .mutation(async ({ input }) => {
      await db.delete(ledZones).where(eq(ledZones.id, input.zoneId));
      await db.delete(devices).where(eq(devices.entityRef, input.zoneId));
      return { id: input.zoneId, status: "deleted" };
    }),

  addScreen: requireScope<{ storeId: string }>((i) => scopeFromRequest({ scope: "store", targetId: i.storeId }))
    .input(
      z.object({
        storeId: z.string(),
        screenId: z.string().min(1).max(64),
        screenType: z.string().min(1).max(32),
        hardwareType: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = `${input.storeId}-${input.screenId}`;
      await db
        .insert(screens)
        .values({
          id,
          storeId: input.storeId,
          screenType: input.screenType,
          hardwareType: input.hardwareType,
          status: "offline",
        })
        .onConflictDoNothing();
      await db.insert(devices).values({
        id: `${id}-player`,
        storeId: input.storeId,
        deviceType: "screen_player",
        label: `${input.hardwareType ?? input.screenType} Player`,
        entityRef: id,
        status: "offline",
      });
      return { id, status: "created" };
    }),

  removeScreen: requireRole("hq_admin", "regional_manager")
    .input(z.object({ screenId: z.string() }))
    .mutation(async ({ input }) => {
      await db.delete(screens).where(eq(screens.id, input.screenId));
      await db.delete(devices).where(eq(devices.entityRef, input.screenId));
      return { id: input.screenId, status: "deleted" };
    }),

  addAudioZone: requireScope<{ storeId: string }>((i) => scopeFromRequest({ scope: "store", targetId: i.storeId }))
    .input(
      z.object({
        storeId: z.string(),
        zoneType: z.enum(["dining", "pickup", "exterior", "back-of-house"]),
        sinkName: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = `${input.storeId}-${input.zoneType}`;
      await db
        .insert(audioZones)
        .values({
          id,
          storeId: input.storeId,
          zoneType: input.zoneType,
          sinkName: input.sinkName ?? `${input.zoneType} Speakers`,
          volume: 0.5,
          status: "offline",
        })
        .onConflictDoNothing();
      await db.insert(devices).values({
        id: `${id}-audio`,
        storeId: input.storeId,
        deviceType: "audio_player",
        label: `${input.sinkName ?? input.zoneType} Node`,
        entityRef: id,
        status: "offline",
      });
      return { id, status: "created" };
    }),

  /** Fleet-wide inventory for the /fleet page. */
  fleetDevices: protectedProcedure.query(async () => {
    const rows = await db.select().from(devices);
    const storeRows = await db.select({ id: stores.id, name: stores.name }).from(stores);
    const nameById = Object.fromEntries(storeRows.map((s) => [s.id, s.name]));
    return rows.map((d) => ({
      id: d.id,
      storeId: d.storeId,
      storeName: nameById[d.storeId] ?? d.storeId,
      deviceType: d.deviceType,
      label: d.label ?? d.id,
      entityRef: d.entityRef,
      firmwareVersion: d.firmwareVersion,
      status: d.status,
      lastSeen: d.lastSeen?.toISOString() ?? null,
    }));
  }),
});
