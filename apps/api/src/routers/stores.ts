import { router, protectedProcedure as publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { stores, ledZones, screens, audioZones } from "@chromacommand/database/schema";
import { eq } from "drizzle-orm";

export const storesRouter = router({
  list: publicProcedure
    .input(z.object({ regionId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const rows = await db.select().from(stores)
        .where(input?.regionId ? eq(stores.regionId, input.regionId) : undefined);

      const result = [];
      for (const store of rows) {
        const zoneRows = await db.select().from(ledZones).where(eq(ledZones.storeId, store.id));
        const screenRows = await db.select().from(screens).where(eq(screens.storeId, store.id));
        const audioRows = await db.select().from(audioZones).where(eq(audioZones.storeId, store.id));

        result.push({
          id: store.id,
          name: store.name,
          region: store.regionId === "cape-town" ? "Cape Town" :
                  store.regionId === "johannesburg" ? "Johannesburg" : "Durban",
          status: store.status === "active" ? "online" : "offline",
          zones: zoneRows.map(z => ({
            id: z.id,
            colour: z.currentColour ?? "#1B2A4A",
            mode: z.currentMode ?? "solid",
            brightness: z.maxBrightness ?? 0.85,
          })),
          screens: screenRows.length,
          activeContent: screenRows.some(s => s.status === "online") ? "Standard Menu" : "No Signal",
          lastHeartbeat: audioRows.length > 0 ? "2s ago" : "—",
          audioZone: audioRows.find(a => a.status === "online")?.sinkName ?? "—",
        });
      }
      return result;
    }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const [store] = await db.select().from(stores).where(eq(stores.id, input.id));
      if (!store) throw new Error("Store not found");

      const zoneRows = await db.select().from(ledZones).where(eq(ledZones.storeId, store.id));
      const screenRows = await db.select().from(screens).where(eq(screens.storeId, store.id));
      const audioRows = await db.select().from(audioZones).where(eq(audioZones.storeId, store.id));

      return {
        id: store.id,
        name: store.name,
        region: store.regionId === "cape-town" ? "Cape Town" :
                store.regionId === "johannesburg" ? "Johannesburg" : "Durban",
        address: store.address ?? "",
        storeManager: "John Dlamini",
        status: store.status === "active" ? "online" : "offline",
        lastHeartbeat: "2026-04-24T18:30:42Z",
        zones: zoneRows.map(z => ({
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
          status: z.status === "online" ? "online" : "offline",
        })),
        screens: screenRows.map(s => ({
          id: s.id,
          type: s.screenType,
          model: s.hardwareType ?? "Unknown",
          hardwareType: s.hardwareType ?? "Unknown",
          status: s.status === "online" ? "online" : "offline",
          currentAsset: "Standard Menu",
        })),
        audioZones: audioRows.map(a => ({
          id: a.id,
          zoneType: a.zoneType,
          zone: a.zoneType,
          sinkName: a.sinkName,
          volume: a.volume ?? 0.45,
          status: a.status === "online" ? "playing" : "stopped",
        })),
      };
    }),
});
