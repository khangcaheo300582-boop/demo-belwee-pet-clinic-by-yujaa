// lib/performance.ts
// Performance monitoring utilities for API routes.
// Tracks request latency, error rates, and slow queries.

interface Metric {
  name: string;
  durationMs: number;
  timestamp: number;
  tags?: Record<string, string>;
}

const metrics: Metric[] = [];
const MAX_METRICS = 1000;

export function recordMetric(name: string, durationMs: number, tags?: Record<string, string>): void {
  metrics.push({ name, durationMs, timestamp: Date.now(), tags });
  if (metrics.length > MAX_METRICS) metrics.shift();
}

/**
 * Wrap an async function to record its execution time.
 */
export async function timed<T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    recordMetric(name, Date.now() - start, tags);
  }
}

/**
 * Get summary statistics for a metric name.
 */
export function getMetricSummary(name: string): {
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
} {
  const values = metrics
    .filter((m) => m.name === name)
    .map((m) => m.durationMs)
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return { count: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const p50 = values[Math.floor(values.length * 0.5)] ?? 0;
  const p95 = values[Math.floor(values.length * 0.95)] ?? 0;
  const p99 = values[Math.floor(values.length * 0.99)] ?? 0;
  const max = values[values.length - 1] ?? 0;

  return {
    count: values.length,
    avgMs: Math.round((sum / values.length) * 100) / 100,
    p50Ms: p50,
    p95Ms: p95,
    p99Ms: p99,
    maxMs: max,
  };
}

/**
 * Get all metric names.
 */
export function getMetricNames(): string[] {
  return [...new Set(metrics.map((m) => m.name))];
}

/**
 * Clear all metrics.
 */
export function clearMetrics(): void {
  metrics.length = 0;
}
