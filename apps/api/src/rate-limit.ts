/**
 * In-process token-bucket-ish rate limiter. Sufficient for single-instance
 * dev/staging. For multi-replica production replace with a Redis-backed
 * implementation (INCR + EXPIRE) so limits are enforced across pods.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

export function consume(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;
  const remaining = Math.max(0, opts.max - bucket.count);
  return {
    allowed: bucket.count <= opts.max,
    remaining,
    resetIn: bucket.resetAt - now,
  };
}

/** Look up current count without incrementing. Used by auth.login so it can
 *  reject early when the bucket is exhausted, without burning a token on
 *  successful credentials. */
export function peek(key: string, max: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    return { allowed: true, remaining: max, resetIn: 0 };
  }
  return {
    allowed: bucket.count < max,
    remaining: Math.max(0, max - bucket.count),
    resetIn: bucket.resetAt - now,
  };
}

// Periodic cleanup so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 60_000).unref?.();
