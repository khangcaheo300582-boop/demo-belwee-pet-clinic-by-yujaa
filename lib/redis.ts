// lib/redis.ts
// Redis client abstraction for production rate limiting + session storage.
// Falls back to an in-memory Map when REDIS_URL is not configured
// (development / single-server deployments).
//
// To upgrade to real Redis:
//   npm add ioredis
//   set REDIS_URL=redis://localhost:6379
//   Update resolveClient() below to use ioredis when REDIS_URL is set.
//
import { createCache } from './cache';

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { EX?: number; PX?: number }): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  incr(key: string): Promise<number>;
  flushall?(): Promise<'OK'>;
}

/** In-memory fallback for dev / single-server. */
class MemoryStore implements RedisLike {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, opts?: { EX?: number; PX?: number }): Promise<'OK' | null> {
    const ttlMs = opts?.EX ? opts.EX * 1000 : opts?.PX ?? 0;
    this.store.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : Date.now() + 86400000 });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return this.store.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const next = current ? parseInt(current, 10) + 1 : 1;
    await this.set(key, String(next));
    return next;
  }
}

/** Resolve the Redis client (in-memory fallback when REDIS_URL is not set). */
function resolveClient(): RedisLike {
  const url = process.env.REDIS_URL;
  if (url) {
    // ioredis not installed in this project. When REDIS_URL is set in
    // production, uncomment the block below and run `npm add ioredis`.
    //
    // const { default: IORedis } = await import('ioredis');
    // return new (IORedis as new (url: string) => RedisLike)(url);
  }
  return new MemoryStore();
}

export const redis = resolveClient();

/** Convenience: cache wrapper for any async function. */
export function cached<T>(
  cache: ReturnType<typeof createCache<T>>,
  key: string,
  fetcher: () => Promise<T>,
  _ttlMs?: number
): Promise<T> {
  const existing = cache.get(key);
  if (existing !== undefined) return Promise.resolve(existing);
  return fetcher().then((value) => {
    cache.set(key, value);
    return value;
  });
}
