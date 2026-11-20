import { NextResponse } from 'next/server';
import { getMetricNames, getMetricSummary } from '@/lib/performance';

export async function GET() {
  const names = getMetricNames();
  const summaries = names.map((name) => ({
    name,
    ...getMetricSummary(name),
  }));

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    metrics: summaries,
  });
}
