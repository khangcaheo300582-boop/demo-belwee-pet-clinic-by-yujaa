// lib/jsonStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// The single file-backed JSON store used by every lib/db*.ts module.
//
// WHY THIS FILE EXISTS
// Seven modules used to carry their own hand-rolled copy of the same
// "mtime read-cache + tmp/rename write" pair, and every copy shared three
// defects. Rather than patch the same bug seven times, the primitive now lives
// here once.
//
//   1. readAll() handed back the LIVE cache array, not a copy. A caller doing
//      `rows.unshift(x)` mutated shared state. If the subsequent write then
//      failed, the in-memory cache kept the row while the file never got it —
//      so read() reported the email as taken and the account did not exist.
//      Reproduced deterministically; see the "POISONED CACHE" case.
//
//   2. Because the array was shared, two concurrent writers both mutated the
//      SAME object and the last write serialised the union. That made plain
//      read-modify-write look safe and hid defect 3, but only by accident.
//
//   3. Once the cache is genuinely invalidated (a second Node process touches
//      the file — `next build` static generation, PM2 cluster mode, a
//      horizontally scaled deploy, a maintenance script), each writer gets its
//      own snapshot and the last one to write silently deletes the other's row.
//      Reproduced deterministically; see the "LOST UPDATE" case.
//
// The guarantees below, in order of how much damage they prevent:
//
//   • read() returns a deep copy. Callers can mutate what they get back; the
//     cache is unreachable from the outside. (fixes 1)
//   • write() is atomic — tmp file, fsync, then rename — and the cache is
//     updated ONLY after the rename succeeds. A failed write can never leave
//     the cache ahead of the disk. (fixes 1)
//   • write() never falls back to overwriting the target in place. A direct
//     overwrite is exactly what produces half-written files, and half-written
//     files are what make a torn read return []. Retries replace the fallback.
//   • An unparseable file is copied aside to <name>.corrupt-<ts>.bak before the
//     store resets to [], so the original bytes survive for recovery instead of
//     being overwritten by the next write.
//   • transact() serialises read → mutate → write across an await within this
//     process, and re-reads uncached after taking the lock so a write that
//     landed while it waited is not clobbered. (fixes 3)
//
// LIMIT, stated honestly: a JSON file cannot give cross-process mutual
// exclusion. Two OS processes can still interleave a read-modify-write if they
// both write inside the same sub-millisecond window. The in-process lock plus
// the mtime revalidation shrinks that window to nothing for the single-server
// deployment this project targets; surviving it needs SQLite or a real
// database, not a better JSON writer.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';

/** Turn a freshly parsed JSON value into the row array, dropping bad rows. */
export type RowNormalizer<T> = (raw: unknown) => T[];

/** Deep-copy plain JSON. `structuredClone` when available, JSON round-trip otherwise. */
function clone<T>(value: T): T {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch {
    // Fall through — some values are not structured-cloneable.
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultNormalize<T>(raw: unknown): T[] {
  return Array.isArray(raw) ? (raw as T[]) : [];
}

/** Windows reports EPERM/EACCES/EBUSY while an indexer or AV holds the handle. */
const RENAME_RETRIES = 5;
const RENAME_RETRY_BASE_MS = 12;

/** Real synchronous sleep — `Atomics.wait` is the only one available in sync code. */
function sleepSync(ms: number): void {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(shared, 0, 0, ms);
}

function isRetryableRenameError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | null)?.code;
  return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY' || code === 'ENOTEMPTY';
}

function makeTempPath(filePath: string): string {
  return `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
}

/**
 * Preserve the bytes of a file we could not parse. Without this the next
 * successful write overwrites the only copy of the data and the loss is silent.
 */
function quarantineSync(filePath: string, raw: string): void {
  try {
    const backup = `${filePath}.corrupt-${Date.now()}.bak`;
    fs.writeFileSync(backup, raw, 'utf-8');
    console.error(
      `[json-store] ${path.basename(filePath)} is not valid JSON. Original bytes kept at ` +
        `${path.basename(backup)} — starting from an empty store.`
    );
  } catch {
    /* best effort */
  }
}

function quarantineAsync(filePath: string, raw: string): Promise<void> {
  return (async () => {
    try {
      const backup = `${filePath}.corrupt-${Date.now()}.bak`;
      await fsp.writeFile(backup, raw, 'utf-8');
      console.error(
        `[json-store] ${path.basename(filePath)} is not valid JSON. Original bytes kept at ` +
          `${path.basename(backup)} — starting from an empty store.`
      );
    } catch {
      /* best effort */
    }
  })();
}

/**
 * Serialises async read-modify-write sequences within this process.
 *
 * The chain is deliberately swallowed on rejection: one failed transaction must
 * not poison the queue for every later one.
 */
function createMutex(): <R>(task: () => Promise<R>) => Promise<R> {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<R>(task: () => Promise<R>): Promise<R> {
    const result = tail.then(task);
    tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };
}

// ─── Synchronous store ─────────────────────────────────────────────────────

export interface JsonStore<T> {
  /** Absolute path of the backing file. */
  readonly filePath: string;
  /**
   * Current rows as a fresh deep copy — safe to sort, splice and mutate.
   * Pass `true` to bypass the mtime cache and re-read from disk.
   */
  read(forceReload?: boolean): T[];
  /** Atomically replace the file. The cache only advances once this resolves. */
  write(rows: readonly T[]): void;
  /** Read → mutate → write with no await in between, so it cannot interleave. */
  update<R>(mutate: (rows: T[]) => R): R;
  /** Read → await → mutate → write, serialised against other `transact` calls. */
  transact<R>(mutate: (rows: T[]) => Promise<R> | R): Promise<R>;
}

export function createJsonStore<T>(fileName: string, normalize?: RowNormalizer<T>): JsonStore<T> {
  const filePath = path.join(process.cwd(), 'data', fileName);
  const dir = path.dirname(filePath);
  const runExclusive = createMutex();

  let cache: T[] | null = null;
  let cacheMtimeMs = -1;
  let dirReady = false;

  function ensureDir(): void {
    if (dirReady) return;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    dirReady = true;
  }

  function load(): T[] {
    let mtimeMs: number;
    try {
      mtimeMs = fs.statSync(filePath).mtimeMs;
    } catch {
      cache = null;
      cacheMtimeMs = -1;
      return [];
    }

    let raw: string;
    try {
      raw = fs.readFileSync(filePath, 'utf-8');
    } catch {
      cache = null;
      cacheMtimeMs = -1;
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      quarantineSync(filePath, raw);
      parsed = [];
    }

    const rows = normalize ? normalize(parsed) : defaultNormalize<T>(parsed);
    cache = rows;
    cacheMtimeMs = mtimeMs;
    return rows;
  }

  function read(forceReload = false): T[] {
    ensureDir();
    if (forceReload) {
      cache = null;
      cacheMtimeMs = -1;
      return clone(load());
    }
    if (cache) {
      try {
        if (fs.statSync(filePath).mtimeMs === cacheMtimeMs) return clone(cache);
      } catch {
        cache = null;
        cacheMtimeMs = -1;
        return [];
      }
    }
    return clone(load());
  }

  function write(rows: readonly T[]): void {
    ensureDir();
    const payload = JSON.stringify(rows, null, 2);
    const tmp = makeTempPath(filePath);

    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeFileSync(fd, payload, 'utf-8');
      // Durability: without this a power cut can leave an empty file behind a
      // successful rename. Best effort — some filesystems refuse to fsync.
      try {
        fs.fsyncSync(fd);
      } catch {
        /* ignore */
      }
    } finally {
      fs.closeSync(fd);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= RENAME_RETRIES; attempt += 1) {
      try {
        fs.renameSync(tmp, filePath);
        lastError = undefined;
        break;
      } catch (err) {
        lastError = err;
        if (!isRetryableRenameError(err)) break;
        if (attempt < RENAME_RETRIES) sleepSync(RENAME_RETRY_BASE_MS * (attempt + 1));
      }
    }

    if (lastError !== undefined) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      // Deliberately no in-place-overwrite fallback: that path is what creates
      // torn files. The cache is left untouched, so readers keep seeing the last
      // state that actually reached disk.
      throw lastError;
    }

    // Only now, after the data is durably on disk, may the cache move.
    cache = clone(rows as T[]);
    try {
      cacheMtimeMs = fs.statSync(filePath).mtimeMs;
    } catch {
      cacheMtimeMs = -1;
    }
  }

  function update<R>(mutate: (rows: T[]) => R): R {
    // Uncached read: this is the write path, so it must see anything another
    // process wrote since the last read rather than trust the cache.
    const rows = read(true);
    const result = mutate(rows);
    write(rows);
    return result;
  }

  return {
    filePath,
    read,
    write,
    update,
    transact<R>(mutate: (rows: T[]) => Promise<R> | R): Promise<R> {
      return runExclusive(async () => {
        // Re-read uncached AFTER the lock: a write that landed while this
        // transaction was queued must not be clobbered by a stale snapshot.
        const rows = read(true);
        const result = await mutate(rows);
        write(rows);
        return result;
      });
    },
  };
}

// ─── Asynchronous store ────────────────────────────────────────────────────

export interface AsyncJsonStore<T> {
  readonly filePath: string;
  read(forceReload?: boolean): Promise<T[]>;
  write(rows: readonly T[]): Promise<void>;
  /** Read → mutate → write, serialised against other calls on this store. */
  update<R>(mutate: (rows: T[]) => Promise<R> | R): Promise<R>;
}

export function createAsyncJsonStore<T>(fileName: string, normalize?: RowNormalizer<T>): AsyncJsonStore<T> {
  const filePath = path.join(process.cwd(), 'data', fileName);
  const dir = path.dirname(filePath);
  const runExclusive = createMutex();

  let cache: T[] | null = null;
  let cacheMtimeMs = -1;

  async function ensureDir(): Promise<void> {
    // Idempotent and cheap; mkdir on an existing directory is a no-op.
    await fsp.mkdir(dir, { recursive: true });
  }

  async function load(): Promise<T[]> {
    let mtimeMs: number;
    try {
      mtimeMs = (await fsp.stat(filePath)).mtimeMs;
    } catch {
      cache = null;
      cacheMtimeMs = -1;
      return [];
    }

    let raw: string;
    try {
      raw = await fsp.readFile(filePath, 'utf-8');
    } catch {
      cache = null;
      cacheMtimeMs = -1;
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await quarantineAsync(filePath, raw);
      parsed = [];
    }

    const rows = normalize ? normalize(parsed) : defaultNormalize<T>(parsed);
    cache = rows;
    cacheMtimeMs = mtimeMs;
    return rows;
  }

  async function read(forceReload = false): Promise<T[]> {
    await ensureDir();
    if (forceReload) {
      cache = null;
      cacheMtimeMs = -1;
      return clone(await load());
    }
    if (cache) {
      try {
        if ((await fsp.stat(filePath)).mtimeMs === cacheMtimeMs) return clone(cache);
      } catch {
        cache = null;
        cacheMtimeMs = -1;
        return [];
      }
    }
    return clone(await load());
  }

  async function write(rows: readonly T[]): Promise<void> {
    await ensureDir();
    const payload = JSON.stringify(rows, null, 2);
    const tmp = makeTempPath(filePath);

    const handle = await fsp.open(tmp, 'w');
    try {
      await handle.writeFile(payload, 'utf-8');
      try {
        await handle.sync();
      } catch {
        /* ignore */
      }
    } finally {
      await handle.close();
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= RENAME_RETRIES; attempt += 1) {
      try {
        await fsp.rename(tmp, filePath);
        lastError = undefined;
        break;
      } catch (err) {
        lastError = err;
        if (!isRetryableRenameError(err)) break;
        if (attempt < RENAME_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RENAME_RETRY_BASE_MS * (attempt + 1)));
        }
      }
    }

    if (lastError !== undefined) {
      try {
        await fsp.unlink(tmp);
      } catch {
        /* ignore */
      }
      throw lastError;
    }

    cache = clone(rows as T[]);
    try {
      cacheMtimeMs = (await fsp.stat(filePath)).mtimeMs;
    } catch {
      cacheMtimeMs = -1;
    }
  }

  return {
    filePath,
    read,
    write,
    update<R>(mutate: (rows: T[]) => Promise<R> | R): Promise<R> {
      return runExclusive(async () => {
        const rows = await read(true);
        const result = await mutate(rows);
        await write(rows);
        return result;
      });
    },
  };
}
