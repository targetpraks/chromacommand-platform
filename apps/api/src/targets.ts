import { db } from "@chromacommand/database";
import { stores } from "@chromacommand/database/schema";
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
 * Authorization check with geo-tree expansion: every required scope must be
 * satisfied either verbatim or by an ancestor geo claim. Loads all stores
 * once per call so N required scopes don't cause N round-trips.
 */
export async function satisfiesScopes(userScopes: string[], required: string[]): Promise<boolean> {
  if (required.length === 0) return true;
  if (userScopes.includes("*")) return true;

  const missingVerbatim = required.filter((r) => !userScopes.includes(r));
  if (missingVerbatim.length === 0) return true;

  const storeClaims = missingVerbatim.filter((r) => r.startsWith("store:"));
  const otherMissing = missingVerbatim.filter((r) => !r.startsWith("store:"));
  if (otherMissing.length > 0) return false; // non-store scopes have no ancestor expansion

  for (const req of storeClaims) {
    const storeId = req.slice("store:".length);
    let covered = false;
    for (const claim of userScopes) {
      if (await scopeCoversStore(claim, storeId)) {
        covered = true;
        break;
      }
    }
    if (!covered) return false;
  }
  return true;
}
