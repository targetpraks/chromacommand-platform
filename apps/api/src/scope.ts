/**
 * Scope helpers — translate dashboard inputs (scope + targetId) into
 * the canonical scope strings used in JWT claims.
 *
 *   scope=global                          → ["*"]
 *   scope=country, targetId=south-africa  → ["country:south-africa"]
 *   scope=province, targetId=western-cape → ["province:western-cape"]
 *   scope=region|city, targetId=cape-town → ["region:cape-town"]
 *   scope=store,    targetId=pp-a01       → ["store:pp-a01"]
 *
 * `region` is retained as the canonical claim name for the city tier so
 * existing tokens ("region:cape-town") keep working.
 */
export type ScopeLevel = "global" | "country" | "province" | "region" | "city" | "store";

export const SCOPE_LEVELS: readonly ScopeLevel[] = ["global", "country", "province", "region", "city", "store"];

export function isScopeLevel(value: string): value is ScopeLevel {
  return (SCOPE_LEVELS as readonly string[]).includes(value);
}

export function scopeForStore(storeId: string): string[] {
  return [`store:${storeId}`];
}

export function scopeForRegion(regionId: string): string[] {
  return [`region:${regionId}`];
}

export function scopeFromRequest(input: { scope: string; targetId: string }): string[] {
  switch (input.scope) {
    case "global":
      return ["*"];
    case "country":
      return [`country:${input.targetId}`];
    case "province":
      return [`province:${input.targetId}`];
    case "store":
      return [`store:${input.targetId}`];
    default:
      // region | city (aliases of the same tier)
      return [`region:${input.targetId}`];
  }
}
