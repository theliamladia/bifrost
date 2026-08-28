import test from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/lib/ratelimit.js';

test('allows up to the limit, then refuses until the window rolls over', () => {
  const limiter = new RateLimiter({ limit: 3, windowMs: 1000 });
  const t0 = 1_000_000;
  assert.equal(limiter.hit('a', t0).ok, true);
  assert.equal(limiter.hit('a', t0).ok, true);
  assert.equal(limiter.hit('a', t0).ok, true);

  const blocked = limiter.hit('a', t0);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterMs > 0);

  // A different key has its own bucket.
  assert.equal(limiter.hit('b', t0).ok, true);
  // ...and the window resets.
  assert.equal(limiter.hit('a', t0 + 1001).ok, true);
});
