import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCache } from './cache';

describe('createCache', () => {
  let cache: ReturnType<typeof createCache<string>>;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = createCache<string>({ ttlMs: 100 });
  });

  afterEach(() => {
    cache.clear();
    vi.useRealTimers();
  });

  it('sets and gets a value', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('returns undefined for missing key', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('expires values after TTL', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
    vi.advanceTimersByTime(150);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('deletes a value', () => {
    cache.set('key1', 'value1');
    cache.del('key1');
    expect(cache.get('key1')).toBeUndefined();
  });

  it('clears all values', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });

  it('reports correct size', () => {
    expect(cache.size()).toBe(0);
    cache.set('a', '1');
    cache.set('b', '2');
    expect(cache.size()).toBe(2);
    cache.del('a');
    expect(cache.size()).toBe(1);
  });

  it('overwrites existing key', () => {
    cache.set('key1', 'value1');
    cache.set('key1', 'value2');
    expect(cache.get('key1')).toBe('value2');
  });
});
