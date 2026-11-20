// scripts/verify-json-store.ts
// Regression tests for lib/jsonStore.ts — the file-backed store behind every
// lib/db*.ts module.
//
// Run with:  npm run test
//
// Each case below corresponds to a real data-loss bug that existed before the
// store was centralised. They are cheap (a few hundred ms) and touch nothing
// outside a throwaway temp directory, so they are safe to run at any time.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createJsonStore, createAsyncJsonStore } from '../lib/jsonStore';

interface Row {
  id: string;
  n: number;
}

// Helper mimicking a minimal Booking shape for the dbBooking idempotency tests.
interface BookingRow {
  id: string;
  time: string;
  addressName: string;
  status: string;
  clientRequestId?: string;
}

/**
 * Reimplementation of the SAME create-with-guards logic as dbBooking.create
 * (same-order checks: idempotency → slot-taken → insert). We test the logic
 * on a plain store rather than importing lib/dbBooking because that module
 * binds its store to process.cwd() at import time and also pulls in nodemailer
 * via bookingService — neither is safe to relocate into the test sandbox.
 */
function guardedCreate(
  rows: BookingRow[],
  data: { time: string; addressName: string; clientRequestId?: string },
  options?: { duplicateSlotCheck?: boolean }
): { created: boolean; reason?: 'duplicate' | 'slot-taken' } {
  if (data.clientRequestId && rows.some(b => b.clientRequestId === data.clientRequestId)) {
    return { created: false, reason: 'duplicate' };
  }
  if (options?.duplicateSlotCheck) {
    const clash = rows.find(
      b => b.addressName === data.addressName &&
        (b.status === 'PENDING' || b.status === 'CONFIRMED') &&
        b.time === data.time
    );
    if (clash) return { created: false, reason: 'slot-taken' };
  }
  rows.push({ ...data, id: `BW_${rows.length}`, status: 'PENDING' });
  return { created: true };
}

const TMP_ROOT = path.join(os.tmpdir(), 'belwee-json-store-test');
const DATA_DIR = path.join(TMP_ROOT, 'data');
const fileOf = (name: string) => path.join(DATA_DIR, name);

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    return;
  }
  failed += 1;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function resetDir(): void {
  // Empty the data dir rather than removing TMP_ROOT itself: by this point
  // TMP_ROOT is the process cwd and Windows refuses to delete it.
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const entry of fs.readdirSync(DATA_DIR)) {
    fs.rmSync(path.join(DATA_DIR, entry), { force: true, recursive: true });
  }
}

async function main(): Promise<void> {
  // The store resolves its path from process.cwd(), so point that at the
  // throwaway directory for the duration of the run.
  const originalCwd = process.cwd();
  resetDir();
  process.chdir(TMP_ROOT);
  try {
    await runAll();
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(TMP_ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}

async function runAll(): Promise<void> {
  const store = createJsonStore<Row>('t.json');

  // ── 1. read() must hand back a copy ────────────────────────────────────
  // Before: readAll() returned the live cache array, so `rows.push(...)` in a
  // caller mutated shared state and survived a failed write.
  resetDir();
  store.write([{ id: 'a', n: 1 }]);
  const copy = store.read();
  copy.push({ id: 'evil', n: 999 });
  copy[0].n = -1;
  check('read() returns a copy — push does not leak', store.read().length === 1, `saw ${store.read().length} rows`);
  check('read() returns a copy — nested mutation does not leak', store.read()[0].n === 1, `saw n=${store.read()[0].n}`);

  // ── 2. a failed write must not advance the cache ───────────────────────
  // Before: `cacheUsers = users` ran before the rename, so a throw left the
  // cache claiming a row that was never persisted.
  resetDir();
  store.write([{ id: 'a', n: 1 }]);
  const realRename = fs.renameSync;
  (fs as unknown as { renameSync: unknown }).renameSync = () => {
    const err = new Error('simulated EPERM') as NodeJS.ErrnoException;
    err.code = 'EPERM';
    throw err;
  };
  let threw = false;
  try {
    store.write([{ id: 'ghost', n: 2 }]);
  } catch {
    threw = true;
  } finally {
    (fs as unknown as { renameSync: unknown }).renameSync = realRename;
  }
  check('write() surfaces a hard rename failure', threw);
  const afterFailure = store.read();
  check(
    'a failed write leaves the cache at the last persisted state',
    afterFailure.length === 1 && afterFailure[0].id === 'a',
    JSON.stringify(afterFailure)
  );
  const onDisk = JSON.parse(fs.readFileSync(fileOf('t.json'), 'utf-8')) as Row[];
  check('a failed write leaves the file untouched', onDisk.length === 1 && onDisk[0].id === 'a', JSON.stringify(onDisk));

  // ── 3. a concurrent external writer must not be clobbered ──────────────
  // Before: once the mtime cache was invalidated (a second Node process wrote
  // the file) each writer held its own snapshot and the last one to write
  // deleted the other's row.
  resetDir();
  store.write([{ id: 'seed', n: 0 }]);
  store.read(); // warm the cache, like a long-lived server process
  fs.writeFileSync(
    fileOf('t.json'),
    JSON.stringify([{ id: 'seed', n: 0 }, { id: 'from-other-process', n: 7 }], null, 2)
  );
  const mine = store.read();
  mine.push({ id: 'mine', n: 1 });
  store.write(mine);
  const ids = store.read().map(r => r.id).sort();
  check('a row written by another process is not deleted', ids.length === 3 && ids.includes('from-other-process'), JSON.stringify(ids));

  // ── 4. transact() serialises read → await → write ──────────────────────
  resetDir();
  const results = await Promise.all([
    store.transact(async rows => {
      await new Promise(r => setTimeout(r, 40));
      rows.push({ id: 'x', n: 1 });
      return 'x';
    }),
    store.transact(async rows => {
      await new Promise(r => setTimeout(r, 10));
      rows.push({ id: 'y', n: 2 });
      return 'y';
    }),
    store.transact(async rows => {
      await new Promise(r => setTimeout(r, 25));
      rows.push({ id: 'z', n: 3 });
      return 'z';
    }),
  ]);
  check('concurrent transact() calls all commit', store.read().length === 3, JSON.stringify(store.read()));
  check('concurrent transact() calls each resolve their own value', results.join(',') === 'x,y,z', results.join(','));

  // ── 5. a rejected transaction must not wedge the queue ─────────────────
  resetDir();
  await store
    .transact(async () => {
      throw new Error('simulated failure');
    })
    .catch(() => undefined);
  const recovered = await store.transact(async rows => {
    rows.push({ id: 'after-failure', n: 1 });
    return 'ok';
  });
  check('a failed transaction does not block later ones', recovered === 'ok' && store.read().length === 1);

  // ── 6. unparseable data is quarantined, not destroyed ──────────────────
  resetDir();
  const corrupt = '[{"id":"precious",';
  fs.writeFileSync(fileOf('t.json'), corrupt);
  const recoveredRows = store.read();
  check('an unparseable file yields an empty store instead of throwing', Array.isArray(recoveredRows));
  const backups = fs.readdirSync(DATA_DIR).filter(f => f.includes('.corrupt-'));
  check('unreadable bytes are preserved as a .bak file', backups.length === 1, JSON.stringify(fs.readdirSync(DATA_DIR)));
  if (backups.length === 1) {
    check('the preserved bytes match the original', fs.readFileSync(fileOf(backups[0]), 'utf-8') === corrupt);
  }

  // ── 7. a non-array JSON document is normalised, not trusted ────────────
  resetDir();
  fs.writeFileSync(fileOf('t.json'), '{"not":"an array"}');
  const notArray = store.read();
  check('a JSON object is normalised to an empty array', Array.isArray(notArray) && notArray.length === 0);

  // ── 8. a custom normaliser filters malformed rows ──────────────────────
  resetDir();
  const filtered = createJsonStore<Row>(
    'n.json',
    raw =>
      (Array.isArray(raw) ? raw : []).filter(
        (r): r is Row => !!r && typeof r === 'object' && typeof (r as Row).id === 'string'
      )
  );
  fs.writeFileSync(fileOf('n.json'), JSON.stringify([{ id: 'ok', n: 1 }, { nope: true }, null]));
  check('a normaliser filters malformed rows', filtered.read().length === 1, JSON.stringify(filtered.read()));

  // ── 9. the async store keeps the same guarantees ───────────────────────
  resetDir();
  const asyncStore = createAsyncJsonStore<Row>('async.json');
  await asyncStore.write([{ id: 'a', n: 1 }]);
  const asyncRows = await asyncStore.read();
  asyncRows.push({ id: 'leak', n: 0 });
  check('async read() returns a copy', (await asyncStore.read()).length === 1);
  await Promise.all([
    asyncStore.update(async rows => {
      await new Promise(r => setTimeout(r, 35));
      rows.push({ id: 'p', n: 1 });
    }),
    asyncStore.update(async rows => {
      await new Promise(r => setTimeout(r, 5));
      rows.push({ id: 'q', n: 2 });
    }),
  ]);
  check('concurrent async update() calls all commit', (await asyncStore.read()).length === 3, JSON.stringify(await asyncStore.read()));

  // ── 10. the file is never observable half-written ──────────────────────
  resetDir();
  store.write([{ id: 'a', n: 1 }]);
  let torn = 0;
  for (let i = 0; i < 300; i += 1) {
    store.write([{ id: 'a', n: i }]);
    try {
      JSON.parse(fs.readFileSync(fileOf('t.json'), 'utf-8'));
    } catch {
      torn += 1;
    }
  }
  check('300 back-to-back writes are never observed torn', torn === 0, `${torn} torn reads`);
  check(
    'no .tmp files are left behind',
    !fs.readdirSync(DATA_DIR).some(f => f.endsWith('.tmp')),
    JSON.stringify(fs.readdirSync(DATA_DIR))
  );

  // ── 11. booking create: idempotency + slot-taken guards ───────────────
  // Same-store reproduction of dbBooking.create's guard order.
  resetDir();
  const bookingStore = createJsonStore<BookingRow>('bookings-test.json');

  // 11a. first request creates
  const first = bookingStore.update(rows => guardedCreate(rows, {
    time: '2026-01-15 09:00',
    addressName: 'Belwee Gò Vấp',
    clientRequestId: 'req-AAA',
  }, { duplicateSlotCheck: true }));
  check('first create with a fresh clientRequestId succeeds', first.created);

  // 11b. same key replays → duplicate, NO new row, NO slot-taken error
  const replay = bookingStore.update(rows => guardedCreate(rows, {
    time: '2026-01-15 09:00',
    addressName: 'Belwee Gò Vấp',
    clientRequestId: 'req-AAA',
  }, { duplicateSlotCheck: true }));
  check(
    'replaying the same clientRequestId is flagged duplicate, not slot-taken',
    !replay.created && replay.reason === 'duplicate',
    JSON.stringify(replay)
  );
  check('a replay does not insert a second booking', bookingStore.read().length === 1);

  // 11c. a DIFFERENT request for the same slot → slot-taken
  const other = bookingStore.update(rows => guardedCreate(rows, {
    time: '2026-01-15 09:00',
    addressName: 'Belwee Gò Vấp',
    clientRequestId: 'req-BBB',
  }, { duplicateSlotCheck: true }));
  check(
    'a different clientRequestId for the same branch+slot is rejected slot-taken',
    !other.created && other.reason === 'slot-taken',
    JSON.stringify(other)
  );
  check('a slot-taken rejection does not insert a booking', bookingStore.read().length === 1);

  // 11d. same time at ANOTHER branch is fine
  const otherBranch = bookingStore.update(rows => guardedCreate(rows, {
    time: '2026-01-15 09:00',
    addressName: 'Belwee Quận 1',
    clientRequestId: 'req-CCC',
  }, { duplicateSlotCheck: true }));
  check('the same slot at a different branch is allowed', otherBranch.created);

  // 11e. a CANCELLED booking does not hold the slot
  bookingStore.update(rows => {
    const idx = rows.findIndex(b => b.clientRequestId === 'req-CCC');
    if (idx !== -1) rows[idx].status = 'CANCELLED';
    return undefined;
  });
  const afterCancel = bookingStore.update(rows => guardedCreate(rows, {
    time: '2026-01-15 09:00',
    addressName: 'Belwee Quận 1',
    clientRequestId: 'req-DDD',
  }, { duplicateSlotCheck: true }));
  check('a cancelled booking frees the slot for others', afterCancel.created);

  // 11f. the idempotency key persists on the winning row
  check(
    'the clientRequestId is stored on the created booking',
    bookingStore.read().some(b => b.clientRequestId === 'req-DDD')
  );
}

void main().then(() => {
  for (const f of failures) console.error(`FAIL  ${f}`);
  console.log(`\njsonStore: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
});
