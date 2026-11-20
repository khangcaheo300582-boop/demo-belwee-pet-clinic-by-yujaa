#!/usr/bin/env node
/**
 * Reliable production-build cleaner: removes `.next` + `tsconfig.tsbuildinfo`.
 *
 * This exists to make `next build` trustworthy and reproducible. It addresses
 * the second-order half of the build-flakiness story; the primary cause was a
 * `next dev` server and `next build` writing the same output directory at the
 * same time, which is now fixed structurally by `distDir` in next.config.mjs
 * (dev writes `.next-dev`, build writes `.next`). Symptoms that used to appear
 * at random:
 *
 *   PageNotFoundError: Cannot find module for page: /_document   (or /api/...)
 *   ENOENT ...\.next\server\pages-manifest.json
 *   app-paths-manifest.json truncated to a single entry
 *   ENOENT ...\.next\server\app\api\...\route.js.nft.json
 *
 * On Windows, PowerShell's `Remove-Item -Recurse -Force .next` frequently
 * fails *partially* on a large Next build dir: locked files (SWC cache,
 * `trace`, an open build handle) make it give up while still reporting
 * success. The leftover half-tree looks exactly like the corruption above, so
 * the reflex was "delete .next again" — which does not help, because the
 * output dir was never the root cause.
 *
 * Two properties make this different from a hand-typed `rm`:
 *   1. `fs.promises.rm` with `maxRetries`/`retryDelay` — the documented Node
 *      API for EBUSY/EPERM on Windows. (`rmSync` ignores those options.)
 *   2. It *verifies* the directory is gone and exits non-zero if it is not.
 *      A clean that silently half-works is worse than no clean at all,
 *      because it looks like it worked.
 *
 * Usage:  npm run clean            → `.next` + tsbuildinfo (safe while `next dev` runs)
 *         npm run clean -- --all   → also removes `.next-dev` (stop dev first)
 */

const fs = require('fs');
const path = require('path');

const APP_DIR = path.resolve(__dirname, '..');

/**
 * `.next` = production output (`next build` / `next start`).
 * `.next-dev` = the dev server's own output (see `distDir` in next.config.mjs).
 *
 * Only `.next` is removed by default. `.next-dev` is deliberately left alone:
 * a running `next dev` does NOT survive its output directory being deleted
 * underneath it — it dies on the next request with a `PageNotFoundError` /
 * missing-manifest failure. `npm run clean` exists to make a *production
 * build* trustworthy, and it can do that without touching the dev server you
 * may be working in right now. Pass `--all` when you really want the dev
 * output gone too (dev server must be stopped first).
 */
const TARGETS = ['.next', 'tsconfig.tsbuildinfo'];
const DEV_TARGET = '.next-dev';
const alsoRemoveDev = process.argv.slice(2).includes('--all');

function remove(target) {
  const abs = path.join(APP_DIR, target);
  if (!fs.existsSync(abs)) {
    console.log(`[clean] ${target} — nothing to remove.`);
    return true;
  }

  // `maxRetries`/`retryDelay` only apply to async rm on Windows, so drive the
  // async API and block on it rather than calling rmSync (whose retry options
  // are ignored and which can leave a partial tree behind).
  return fs.promises
    .rm(abs, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
    .then(() => {
      const gone = !fs.existsSync(abs);
      console.log(
        gone
          ? `[clean] ${target} — removed.`
          : `[clean] ${target} — ERROR: still present after rm.`
      );
      return gone;
    })
    .catch((err) => {
      console.error(`[clean] ${target} — ERROR: ${err.message}`);
      console.error(
        `[clean] Something still holds a file in ${target} (a running dev server? ` +
          'a leftover `next build`?). Close it, then run this again.'
      );
      return false;
    });
}

(async () => {
  const targets = alsoRemoveDev ? [...TARGETS, DEV_TARGET] : TARGETS;
  const results = [];
  for (const target of targets) {
    results.push(await remove(target));
  }

  if (results.includes(false)) {
    console.error('\n[clean] Incomplete. Falling back to cmd rmdir (Windows-safe)…');
    if (process.platform === 'win32') {
      for (const target of targets) {
        const abs = path.join(APP_DIR, target);
        if (!fs.existsSync(abs)) continue;
        try {
          require('child_process').execFileSync('cmd', ['/c', 'rmdir', '/s', '/q', abs], {
            stdio: 'ignore',
          });
          console.log(`[clean] ${target} — removed via rmdir.`);
        } catch {
          /* reported by the verification below */
        }
      }
    }
  }

  // Final gate: never report success on a half-deleted tree.
  const leftovers = targets.filter((t) => fs.existsSync(path.join(APP_DIR, t)));
  if (leftovers.length) {
    console.error(`\n[clean] FAILED — could not remove: ${leftovers.join(', ')}`);
    process.exit(1);
  }

  if (!alsoRemoveDev && fs.existsSync(path.join(APP_DIR, DEV_TARGET))) {
    console.log(`[clean] ${DEV_TARGET} left untouched (use \`npm run clean -- --all\` to remove it).`);
  }
  console.log('\n[clean] Clean. Safe to run `npm run build`.');
})();
