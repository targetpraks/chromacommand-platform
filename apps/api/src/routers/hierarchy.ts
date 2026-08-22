import { router, protectedProcedure, requireRole } from "../trpc";
import { z } from "zod";
import { db } from "@chromacommand/database";
import {
  countries,
  provinces,
  cities,
  stores,
  ledZones,
  screens,
  audioZones,
  devices,
} from "@chromacommand/database/schema";
import { eq } from "drizzle-orm";

const slug = z.string().min(1).max(32).regex(/^[a-z0-9-]+$/, "lowercase letters, digits, hyphens");

/**
 * Geographic hierarchy — the backbone of scope control.
 *   country → province → city → store → (zones | screens | audio | devices)
 * `region:{cityId}` claims in JWTs resolve through this tree.
 */
export const hierarchyRouter = router({
  /** Full nested tree with roll-up counts + online status per store. */
  tree: protectedProcedure.query(async () => {
    const [countryRows, provinceRows, cityRows, storeRows, zoneRows, screenRows, audioRows, deviceRows] =
      await Promise.all([
        db.select().from(countries),
        db.select().from(provinces),
        db.select().from(cities),
        db.select().from(stores),
        db.select().from(ledZones),
        db.select().from(screens),
        db.select().from(audioZones),
        db.select().from(devices),
      ]);

    const zonesByStore = new Map<string, typeof zoneRows>();
    for (const z of zoneRows) {
      if (!zonesByStore.has(z.storeId)) zonesByStore.set(z.storeId, []);
      zonesByStore.get(z.storeId)!.push(z);
    }
    const screensByStore = new Map<string, number>();
    const audioByStore = new Map<string, number>();
    const devicesByStore = new Map<string, { total: number; online: number }>();
    for (const s of screenRows) screensByStore.set(s.storeId, (screensByStore.get(s.storeId) ?? 0) + 1);
    for (const a of audioRows) audioByStore.set(a.storeId, (audioByStore.get(a.storeId) ?? 0) + 1);
    for (const d of deviceRows) {
      const cur = devicesByStore.get(d.storeId) ?? { total: 0, online: 0 };
      cur.total++;
      if (d.status === "online") cur.online++;
      devicesByStore.set(d.storeId, cur);
    }

    const storeNodes = storeRows.map((s) => {
      const zones = zonesByStore.get(s.id) ?? [];
      return {
        id: s.id,
        name: s.name,
        status: s.status === "active" ? "online" : s.status,
        address: s.address ?? "",
        counts: {
          zones: zones.length,
          onlineZones: zones.filter((z) => z.status === "online").length,
          screens: screensByStore.get(s.id) ?? 0,
          audioZones: audioByStore.get(s.id) ?? 0,
          devices: devicesByStore.get(s.id)?.total ?? 0,
          devicesOnline: devicesByStore.get(s.id)?.online ?? 0,
        },
      };
    });

    const storesByCity = new Map<string, typeof storeNodes>();
    for (const node of storeNodes) {
      const store = storeRows.find((s) => s.id === node.id)!;
      const key = store.cityId ?? store.regionId;
      if (!storesByCity.has(key)) storesByCity.set(key, []);
      storesByCity.get(key)!.push(node);
    }

    return countryRows.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      provinces: provinceRows
        .filter((p) => p.countryId === c.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          cities: cityRows
            .filter((ct) => ct.provinceId === p.id)
            .map((ct) => ({
              id: ct.id,
              name: ct.name,
              stores: storesByCity.get(ct.id) ?? [],
            })),
        })),
    }));
  }),

  createCountry: requireRole("hq_admin")
    .input(z.object({ id: slug, name: z.string().min(1).max(128), code: z.string().max(8).optional() }))
    .mutation(async ({ input }) => {
      await db.insert(countries).values(input).onConflictDoNothing();
      return { id: input.id, status: "created" };
    }),

  createProvince: requireRole("hq_admin")
    .input(z.object({ id: slug, name: z.string().min(1).max(128), countryId: slug }))
    .mutation(async ({ input }) => {
      await db.insert(provinces).values(input).onConflictDoNothing();
      return { id: input.id, status: "created" };
    }),

  createCity: requireRole("hq_admin")
    .input(z.object({ id: slug, name: z.string().min(1).max(128), provinceId: slug }))
    .mutation(async ({ input }) => {
      await db.insert(cities).values(input).onConflictDoNothing();
      return { id: input.id, status: "created" };
    }),

  updateCountry: requireRole("hq_admin")
    .input(z.object({ id: slug, name: z.string().min(1).max(128).optional(), code: z.string().max(8).optional() }))
    .mutation(async ({ input }) => {
      const { id, ...set } = input;
      if (Object.keys(set).length > 0) await db.update(countries).set(set).where(eq(countries.id, id));
      return { id, status: "updated" };
    }),

  updateProvince: requireRole("hq_admin")
    .input(z.object({ id: slug, name: z.string().min(1).max(128).optional() }))
    .mutation(async ({ input }) => {
      const { id, ...set } = input;
      if (Object.keys(set).length > 0) await db.update(provinces).set(set).where(eq(provinces.id, id));
      return { id, status: "updated" };
    }),

  updateCity: requireRole("hq_admin")
    .input(z.object({ id: slug, name: z.string().min(1).max(128).optional() }))
    .mutation(async ({ input }) => {
      const { id, ...set } = input;
      if (Object.keys(set).length > 0) await db.update(cities).set(set).where(eq(cities.id, id));
      return { id, status: "updated" };
    }),
});
