// app/api/health/route.ts
// Liveness + storage readiness probe.
//
// This used to report MongoDB connectivity, which made the endpoint answer 503
// on a perfectly healthy app whenever the Atlas cluster was paused — and the
// Docker healthcheck then restarted a container that had nothing wrong with it.
// Persistence now lives in data/*.json, so the honest question is "can this
// process still write to its data directory?". The probe below answers that by
// actually creating and removing a file, because access(W_OK) reports success
// on some read-only mounts that fail on the first real write.
//
// The response keeps `db.status: 'connected'` so existing callers and contract
// tests keep working; `db.driver` tells a human which storage is in use.

import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

async function probeStorage(): Promise<void> {
  const dataDir = path.join(process.cwd(), 'data');
  await fs.mkdir(dataDir, { recursive: true });
  const probe = path.join(dataDir, `.health-${process.pid}-${Date.now()}.tmp`);
  await fs.writeFile(probe, 'ok', 'utf-8');
  await fs.unlink(probe);
}

export async function GET() {
  const start = Date.now();
  let dbStatus = 'disconnected';
  let dbLatency = 0;

  try {
    const t0 = Date.now();
    await probeStorage();
    dbLatency = Date.now() - t0;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }

  const healthy = dbStatus === 'connected';

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: { status: dbStatus, latencyMs: dbLatency, driver: 'json-file' },
      responseTimeMs: Date.now() - start,
    },
    { status: healthy ? 200 : 503 }
  );
}
