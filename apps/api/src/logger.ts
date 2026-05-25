import type { FastifyBaseLogger } from "fastify";

let ref: FastifyBaseLogger | null = null;

export function setAppLogger(l: FastifyBaseLogger): void {
  ref = l;
}

/** Returns the app-level logger if set, otherwise a minimal fallback. */
export function appLog(): FastifyBaseLogger {
  if (ref) return ref;
  // Minimal pino-like fallback so console.* replacements still compile
  const fallback = {
    info: (msg: string | Record<string, unknown>, ...args: unknown[]) => console.log(msg, ...args),
    warn: (msg: string | Record<string, unknown>, ...args: unknown[]) => console.warn(msg, ...args),
    error: (msg: string | Record<string, unknown>, ...args: unknown[]) => console.error(msg, ...args),
    debug: (msg: string | Record<string, unknown>, ...args: unknown[]) => void 0,
    trace: (msg: string | Record<string, unknown>, ...args: unknown[]) => void 0,
    fatal: (msg: string | Record<string, unknown>, ...args: unknown[]) => console.error(msg, ...args),
    child: () => fallback,
    silent: () => void 0,
  } as unknown as FastifyBaseLogger;
  return fallback;
}
