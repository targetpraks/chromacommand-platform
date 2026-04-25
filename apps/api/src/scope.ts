/**
 * Scope helpers — translate dashboard inputs (scope + targetId) into
 * the canonical scope strings used in JWT claims.
 *
 *   scope=store, targetId=pp-a01     → ["store:pp-a01"]
 *   scope=region, targetId=cape-town → ["region:cape-town"]
 *   scope=global                      → ["*"]
 *
 * For single-resource queries (storeId only), use scopeForStore.
 */
export function scopeForStore(storeId: string): string[] {
  return [`store:${storeId}`];
}

export function scopeForRegion(regionId: string): string[] {
  return [`region:${regionId}`];
}

export function scopeFromRequest(input: { scope: string; targetId: string }): string[] {
  if (input.scope === "global") return ["*"];
  if (input.scope === "region") return [`region:${input.targetId}`];
  return [`store:${input.targetId}`];
}
