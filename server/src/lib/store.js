/**
 * Minimal TTL key/value store.
 *
 * In-memory on purpose for v1: challenges and sessions are short-lived and we
 * deliberately do not persist anything about who searched for whom. Swap in
 * Redis by implementing the same four methods.
 */
export class TtlStore {
  #map = new Map();

  set(key, value, ttlMs) {
    this.#map.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  get(key) {
    const entry = this.#map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.#map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  delete(key) {
    return this.#map.delete(key);
  }

  sweep(now = Date.now()) {
    let removed = 0;
    for (const [key, entry] of this.#map) {
      if (entry.expiresAt <= now) {
        this.#map.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  get size() {
    this.sweep();
    return this.#map.size;
  }
}

export const challenges = new TtlStore();
export const sessions = new TtlStore();
export const grants = new TtlStore();

const sweeper = setInterval(() => {
  challenges.sweep();
  sessions.sweep();
  grants.sweep();
}, 60 * 1000);
sweeper.unref?.();
