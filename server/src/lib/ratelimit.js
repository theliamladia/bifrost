/**
 * Fixed-window counter, keyed however the caller wants (IP, contact, session).
 *
 * The scanner spends money per query and sends real SMS, so every entry point
 * that costs something is capped.
 */
export class RateLimiter {
  #buckets = new Map();

  constructor({ limit, windowMs }) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** @returns {{ ok: boolean, remaining: number, retryAfterMs: number }} */
  hit(key, now = Date.now()) {
    const bucket = this.#buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.#buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { ok: true, remaining: this.limit - 1, retryAfterMs: 0 };
    }
    bucket.count += 1;
    if (bucket.count > this.limit) {
      return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
    }
    return { ok: true, remaining: this.limit - bucket.count, retryAfterMs: 0 };
  }

  reset(key) {
    this.#buckets.delete(key);
  }
}

export function limiterMiddleware(limiter, keyFn) {
  return (req, res, next) => {
    const { ok, retryAfterMs } = limiter.hit(keyFn(req));
    if (!ok) {
      res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      return res.status(429).json({
        error: 'rate_limited',
        message: `Too many requests. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`,
      });
    }
    return next();
  };
}
