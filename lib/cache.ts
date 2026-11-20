// lib/cache.ts
// In-memory cache for hot data (user sessions, OTP state, config).
// Redis-ready: swap `store` implementation without changing the public API.
//
// Usage:
//   const userCache = createCache<User>({ ttlMs: 5 * 60 * 1000 });
//   userCache.set(userId, user);
//   const cached = userCache.get(userId);

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export function createCache<T>({ ttlMs }: { ttlMs: number }) {
  const store = new Map<string, CacheEntry<T>>();

  function get(key: string): T | undefined {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key: string, value: T): void {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  function del(key: string): void {
    store.delete(key);
  }

  function clear(): void {
    store.clear();
  }

  function size(): number {
    let valid = 0;
    const now = Date.now();
    for (const entry of store.values()) {
      if (now <= entry.expiresAt) valid += 1;
    }
    return valid;
  }

  return { get, set, del, clear, size };
}
