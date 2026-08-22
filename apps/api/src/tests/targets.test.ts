import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { db } from "@chromacommand/database";
import { countries, provinces, cities, stores } from "@chromacommand/database/schema";
import { eq } from "drizzle-orm";
import { scopeFromRequest } from "../scope";
import { resolveStoreTargets, scopeCoversStore, satisfiesScopes } from "../targets";

// Skip DB-backed suites when Postgres isn't reachable (CI provides one).
const TEST_DB_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/chromacommand";
let dbUp = false;
{
  const probe = new Client({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 2500 });
  try {
    await probe.connect();
    await probe.query("SELECT 1");
    dbUp = true;
  } catch {
    console.warn("[targets.test] No reachable Postgres — skipping geo-expansion suites.");
  } finally {
    await probe.end().catch(() => {});
  }
}
const withDb = dbUp ? describe : describe.skip;
const maybeBeforeAll = dbUp ? beforeAll : (() => {}) as typeof beforeAll;
const maybeAfterAll = dbUp ? afterAll : (() => {}) as typeof afterAll;

const suffix = randomBytes(3).toString("hex");
const COUNTRY = `test-c-${suffix}`;
const PROVINCE = `test-p-${suffix}`;
const CITY = `test-city-${suffix}`;
const STORE_A = `pp-test-a${suffix}`;
const STORE_B = `pp-test-b${suffix}`;

maybeBeforeAll(async () => {
  await db.insert(countries).values({ id: COUNTRY, name: "Testland", code: "TS" }).onConflictDoNothing();
  await db.insert(provinces).values({ id: PROVINCE, countryId: COUNTRY, name: "Test Province" }).onConflictDoNothing();
  await db.insert(cities).values({ id: CITY, provinceId: PROVINCE, name: "Test City" }).onConflictDoNothing();
  await db.insert(stores).values([
    { id: STORE_A, name: "Target A", regionId: CITY, cityId: CITY, provinceId: PROVINCE, countryId: COUNTRY },
    { id: STORE_B, name: "Other Region Store", regionId: "elsewhere" },
  ]).onConflictDoNothing();
});

maybeAfterAll(async () => {
  await db.delete(stores).where(eq(stores.id, STORE_A));
  await db.delete(stores).where(eq(stores.id, STORE_B));
  await db.delete(cities).where(eq(cities.id, CITY));
  await db.delete(provinces).where(eq(provinces.id, PROVINCE));
  await db.delete(countries).where(eq(countries.id, COUNTRY));
});

describe("scopeFromRequest", () => {
  it("maps every level to its canonical claim", () => {
    expect(scopeFromRequest({ scope: "global", targetId: "" })).toEqual(["*"]);
    expect(scopeFromRequest({ scope: "country", targetId: "za" })).toEqual(["country:za"]);
    expect(scopeFromRequest({ scope: "province", targetId: "wc" })).toEqual(["province:wc"]);
    expect(scopeFromRequest({ scope: "region", targetId: "cape-town" })).toEqual(["region:cape-town"]);
    expect(scopeFromRequest({ scope: "city", targetId: "cape-town" })).toEqual(["region:cape-town"]);
    expect(scopeFromRequest({ scope: "store", targetId: "pp-a01" })).toEqual(["store:pp-a01"]);
  });
});

withDb("resolveStoreTargets", () => {
  it("store scope resolves to exactly that store", async () => {
    const r = await resolveStoreTargets({ scope: "store", targetId: STORE_A });
    expect(r.storeIds).toEqual([STORE_A]);
  });

  it("city/region scope expands through the geo tree", async () => {
    const r = await resolveStoreTargets({ scope: "region", targetId: CITY });
    expect(r.storeIds).toContain(STORE_A);
    expect(r.storeIds).not.toContain(STORE_B);
  });

  it("province and country scopes cascade down the tree", async () => {
    const p = await resolveStoreTargets({ scope: "province", targetId: PROVINCE });
    const c = await resolveStoreTargets({ scope: "country", targetId: COUNTRY });
    expect(p.storeIds).toContain(STORE_A);
    expect(p.storeIds).not.toContain(STORE_B);
    expect(c.storeIds).toContain(STORE_A);
    expect(c.storeIds).not.toContain(STORE_B);
  });

  it("global resolves to more than one store", async () => {
    const g = await resolveStoreTargets({ scope: "global", targetId: "all" });
    expect(g.storeIds.length).toBeGreaterThanOrEqual(2);
  });
});

withDb("scopeCoversStore / satisfiesScopes", () => {
  it("ancestor claims cover descendant stores", async () => {
    expect(await scopeCoversStore(`country:${COUNTRY}`, STORE_A)).toBe(true);
    expect(await scopeCoversStore(`province:${PROVINCE}`, STORE_A)).toBe(true);
    expect(await scopeCoversStore(`region:${CITY}`, STORE_A)).toBe(true);
    expect(await scopeCoversStore(`store:${STORE_A}`, STORE_A)).toBe(true);
    expect(await scopeCoversStore(`region:${CITY}`, STORE_B)).toBe(false);
    expect(await scopeCoversStore("*", STORE_B)).toBe(true);
  });

  it("satisfiesScopes expands region claims over store requirements", async () => {
    expect(await satisfiesScopes([`region:${CITY}`], [`store:${STORE_A}`])).toBe(true);
    expect(await satisfiesScopes([`region:${CITY}`], [`store:${STORE_B}`])).toBe(false);
    expect(await satisfiesScopes([`province:${PROVINCE}`], [`store:${STORE_A}`])).toBe(true);
    expect(await satisfiesScopes(["*"], [`store:${STORE_B}`])).toBe(true);
    expect(await satisfiesScopes([], ["anything"])).toBe(false);
  });
});
