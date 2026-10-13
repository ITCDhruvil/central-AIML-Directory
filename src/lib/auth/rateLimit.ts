export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

type Options = { max: number; windowMs: number; now?: () => number };
/** Per-call override, so limits that an administrator can change are applied without rebuilding the limiter. */
type Override = { max?: number; windowMs?: number };

/**
 * Fixed-window in-memory limiter. Per server instance only — it slows brute force on a
 * single instance but is not a global guarantee on serverless. Good enough as a first layer.
 *
 * `peek` asks "is this key blocked right now?" without counting; `check` counts an attempt.
 * Login uses peek before verifying and check only for failures, so successful sign-ins never lock anyone out.
 */
export function createRateLimiter({ max, windowMs, now = Date.now }: Options) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  function blocked(key: string, limit: number = max): RateLimitResult {
    const entry = hits.get(key);
    if (entry && entry.resetAt > now() && entry.count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now()) / 1000)) };
    }
    return { allowed: true };
  }

  return {
    peek(key: string, override: Override = {}): RateLimitResult {
      return blocked(key, override.max ?? max);
    },
    check(key: string, override: Override = {}): RateLimitResult {
      const limit = override.max ?? max;
      const span = override.windowMs ?? windowMs;
      const t = now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= t) {
        hits.set(key, { count: 1, resetAt: t + span });
        return { allowed: true };
      }
      if (entry.count >= limit) return blocked(key, limit);
      entry.count += 1;
      return { allowed: true };
    },
    reset(key: string) {
      hits.delete(key);
    },
  };
}
