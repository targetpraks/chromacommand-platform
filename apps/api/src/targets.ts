import { db } from "@chromacommand/database";
import { stores, provinces, cities } from "@chromacommand/database/schema";
import { eq } from "drizzle-orm";

export interface ResolvedTargets {
  scope: string;
  targetId: string;
  storeIds: string[];
}

/**
 * Expand any scope+target pair into the concrete list of store ids it
 * addresses. This is THE fan-out primitive — every mutating router uses it
 * so "global"/geo scopes actually reach every store instead of publishing
 * to a literal topic named after the target.
 */
export async function resolveStoreTargets(input: { scope: string; targetId: string }): Promise<ResolvedTargets> {
  if (input.scope === "store") {
    return { scope: input.scope, targetId: input.targetId, storeIds: [input.targetId] };
  }

  const rows = await db.select().from(stores);
  let storeIds: string[];

  switch (input.scope) {
    case "global":
      storeIds = rows.map((s) => s.id);
      break;
    case "country":
      storeIds = rows.filter((s) => s.countryId === input.targetId).map((s) => s.id);
      break;
    case "province":
      storeIds = rows.filter((s) => s.provinceId === input.targetId).map((s) => s.id);
      break;
    case "region":
    case "city":
      // Legacy region_id holds the same slug as city_id for the SA network.
      storeIds = rows
        .filter((s) => s.cityId === input.targetId || s.regionId === input.targetId)
        .map((s) => s.id);
      break;
    default:
      throw new Error(`Unknown scope level: ${input.scope}`);
  }

  return { scope: input.scope, targetId: input.targetId, storeIds };
}

/**
 * Does a single scope claim cover a given store? Geo claims expand through
 * the tree: country → province → city → store.
 */
export async function scopeCoversStore(claim: string, storeId: string): Promise<boolean> {
  if (claim === "*") return true;
  const sep = claim.indexOf(":");
  if (sep < 0) return false;
  const level = claim.slice(0, sep);
  const id = claim.slice(sep + 1);

  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return false;

  switch (level) {
    case "store":
      return store.id === id;
    case "region":
    case "city":
      return store.cityId === id || store.regionId === id;
    case "province":
      return store.provinceId === id;
    case "country":
      return store.countryId === id;
    default:
      return false;
  }
}

/**
 * Resolve the ancestry chain of a geo node so we can test whether a user's
 * claim at any ancestor level authorizes control of the target.
 * Returns the set of canonical scope strings that ALL cover this node:
 *   city X  → { region:X, province:P, country:C }
 *   province P → { province:P, country:C }
 *   country C → { country:C }
 */
async function ancestorClaims(scope: string, targetId: string): Promise<string[]> {
  if (scope === "country") return [`country:${targetId}`];

  if (scope === "province") {
    const [prov] = await db.select().from(provinces).where(eq(provinces.id, targetId)).limit(1);
    if (!prov) return [`province:${targetId}`];
    return [`province:${targetId}`, `country:${prov.countryId}`];
  }

  if (scope === "region" || scope === "city") {
    const [city] = await db.select().from(cities).where(eq(cities.id, targetId)).limit(1);
    if (!city) return [`region:${targetId}`];
    const [prov] = await db.select().from(provinces).where(eq(provinces.id, city.provinceId)).limit(1);
    return [`region:${targetId}`, `province:${city.provinceId}`, ...(prov ? [`country:${prov.countryId}`] : [])];
  }

  return [`${scope}:${targetId}`];
}

/**
 * Authorization check with geo-tree expansion: every required scope must be
 * satisfied either verbatim or by an ancestor geo claim. Required non-store
 * scopes (region/province/country) are covered when the user holds any claim
 * in that node's ancestry chain.
 */
export async function satisfiesScopes(userScopes: string[], required: string[]): Promise<boolean> {
  if (required.length === 0) return true;
  if (userScopes.includes("*")) return true;

  const missingVerbatim = required.filter((r) => !userScopes.includes(r));
  if (missingVerbatim.length === 0) return true;

  for (const req of missingVerbatim) {
    const sep = req.indexOf(":");
    if (sep < 0) return false;
    const level = req.slice(0, sep);
    const id = req.slice(sep + 1);

    if (level === "store") {
      let covered = false;
      for (const claim of userScopes) {
        if (await scopeCoversStore(claim, id)) {
          covered = true;
          break;
        }
      }
      if (!covered) return false;
      continue;
    }

    if (level === "global") {
      return false; // only "*" authorizes global, already checked above
    }

    // Geo-node required: covered if the user holds any ancestor claim.
    const claims = await ancestorClaims(level, id);
    const covered = claims.some((c) => userScopes.includes(c));
    if (!covered) return false;
  }
  return true;
}
