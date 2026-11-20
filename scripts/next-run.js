#!/usr/bin/env node
/**
 * Self-healing Next.js dev / start launcher.
 *
 * Root-cause fix for: `npm run dev` fails with
 *   "Error: listen EADDRINUSE: address already in use :::3001"
 * and the app then answering 404 in the browser.
 *
 * On Windows, a Next server orphaned by a previous session (closing the
 * terminal without Ctrl+C, a Crashed npm parent while the node child survives,
 * etc.) keeps owning the port forever. Every later `npm run dev` dies with
 * EADDRINUSE, so no live server exists and the browser only sees stale/broken
 * pages (404). This script:
 *
 *   1. Resolves the port: CLI --port > env PORT > .env.local PORT > default 3001.
 *   2. Finds the process listening on that port. If it is a Next.js server
 *      belonging to THIS project (verified through its command line — foreign
 *      processes are never touched), it terminates it so the port is free.
 *   3. Prints a startup banner: real URLs, the distDir in use, and the security
 *      posture this run inherited from .env.local.
 *   4. Starts `next <mode> -p <port>` as a child and mirrors stdio.
 *   5. Collapses bursts of identical [audit] lines so a throttled client prints
 *      as one `×N` line instead of one line per request.
 *   6. Kills the child tree on SIGINT/SIGTERM (Ctrl+C / terminal close) so no
 *      orphan is left behind — the actual root cause above — keeping the port
 *      clean for the next run.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const IS_WIN = process.platform === 'win32';
const APP_DIR = path.resolve(__dirname, '..');
const NEXT_BIN = path.join(APP_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');
const PKG = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8'));

// ── colour ──────────────────────────────────────────────────────────────────
const COLOR = process.env.FORCE_COLOR !== '0' && process.env.NO_COLOR === undefined
  && (process.stderr.isTTY || process.env.FORCE_COLOR === '1');
const paint = (code) => (text) => (COLOR ? `\u001b[${code}m${text}\u001b[0m` : String(text));
const c = {
  bold: paint('1'),
  dim: paint('2'),
  cyan: paint('36'),
  green: paint('32'),
  yellow: paint('33'),
  magenta: paint('35'),
};

function readEnvLocal() {
  const values = {};
  try {
    const raw = fs.readFileSync(path.join(APP_DIR, '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m) values[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env.local — the banner simply reports less */
  }
  return values;
}

function resolveHostname(explicit) {
  if (explicit) return explicit;
  const envLocal = readEnvLocal();
  return envLocal.HOSTNAME || '0.0.0.0';
}

function lanAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs || []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      // Prefer a private LAN address; fall back to anything routable.
      const priv = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(addr.address);
      candidates.push({ address: addr.address, priv, name });
    }
  }
  candidates.sort((a, b) => Number(b.priv) - Number(a.priv));
  return candidates[0]?.address || null;
}

function readmeTitle() {
  return String(PKG.name || 'next app')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function printBanner({ port, mode, hostname, hostArg }) {
  const local = `http://localhost:${port}`;
  const lan = lanAddress();
  const wide = hostname === '0.0.0.0' || hostname === '::';
  const envLocal = readEnvLocal();

  const title = readmeTitle();
  const stack = `Next.js ${PKG.dependencies?.next || '?'} · ${mode} · TypeScript · App Router`;
  const innerWidth = Math.max(
    title.length,
    stack.length,
    40,
  );
  const frame = '\u2500'.repeat(innerWidth + 4);

  const row = (label, value) => `  ${c.dim(label.padEnd(9))} ${value}`;

  const out = [];
  out.push('');
  out.push(c.cyan(`\u250C${frame}\u2510`));
  out.push(`\u2502  ${c.bold(title)}${' '.repeat(Math.max(0, innerWidth - title.length))}  \u2502`);
  out.push(`\u2502  ${c.dim(stack)}${' '.repeat(Math.max(0, innerWidth - stack.length))}  \u2502`);
  out.push(c.cyan(`\u251C${frame}\u2524`));
  out.push(row('local', c.green(local)));
  if (wide && lan) {
    out.push(row('network', c.green(`http://${lan}:${port}`)));
  } else if (hostArg) {
    out.push(row('network', c.dim(`bound to ${hostname} (LAN off)`)));
  } else {
    out.push(row('network', c.dim('bound to localhost (LAN off)')));
  }
  out.push(row('staff', c.dim(`${local}/staff/login`)));
  out.push(row('sign in', c.dim(`${local}/dang-nhap`)));
  out.push('');

  const distDir = mode === 'dev' ? '.next-dev' : '.next';
  out.push(row('build', c.dim(`distDir ${distDir} · ${mode === 'dev' ? 'fast refresh' : 'production'}`)));

  const origins = (envLocal.SECURITY_TRUSTED_ORIGINS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const configured = [envLocal.NEXTAUTH_URL, envLocal.NEXT_PUBLIC_BASE_URL, ...origins]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
  out.push(
    row('origins', configured.length
      ? c.dim(configured.join(', '))
      : c.yellow('none in .env.local — only same-origin is trusted')),
  );

  // Env health: the two failures that used to be invisible until a request
  // failed (missing OTP mail credentials → 502, shared secrets → weaker auth).
  const REQUIRED = ['NEXTAUTH_SECRET', 'EMAIL_USER', 'EMAIL_PASS', 'OTP_HASH_SECRET', 'STAFF_RECOVERY_CODE'];
  const missing = REQUIRED.filter((key) => !envLocal[key]);
  const SECRETS = ['NEXTAUTH_SECRET', 'STAFF_SESSION_SECRET', 'OTP_HASH_SECRET', 'JWT_SECRET', 'RESET_TOKEN_HASH_SECRET'];
  const groups = {};
  for (const key of SECRETS) {
    const value = envLocal[key];
    if (!value) continue;
    (groups[value] ||= []).push(key);
  }
  const reused = Object.values(groups).filter((keys) => keys.length > 1);
  const envHealth = [
    missing.length
      ? c.yellow(`missing ${missing.join(', ')} — those routes return 503`)
      : c.green('email + auth configured (OTP, staff login, reset)'),
    reused.length
      ? c.yellow(`shared secret: ${reused.map((keys) => keys.join('=')).join('; ')}`)
      : null,
  ].filter(Boolean).join(' · ');
  out.push(row('env', envHealth));

  const audit = envLocal.SECURITY_AUDIT === 'true' ? 'file + console' : 'console';
  out.push(row('audit', c.dim(`${audit} · JSON when piped · repeats collapsed here`)));
  out.push(c.cyan(`\u2514${frame}\u2518`));
  out.push('');

  process.stdout.write(out.join('\n') + '\n');
}

// ── repeat-collapsing stderr pump ──────────────────────────────────────────
/**
 * Middleware writes [audit] lines to stderr with console.warn. When a client
 * trips a guard, that is one line per request — a single mis-throttled page
 * load can bury the real compile output. Consecutive identical lines collapse
 * into one with a ×N counter, flushed as soon as anything else arrives or after
 * a short quiet period.
 *
 * Only stderr is piped. stdout stays inherited so Next.js keeps full control of
 * its own cursor-positioned progress rendering; re-emitting it line by line
 * would corrupt the spinner.
 */
function createStderrPump(target) {
  const ANSI = /\u001b\[[0-9;]*m/g;
  const QUIET_MS = 4000;

  let buffer = '';
  let pending = null; // { line, shape, count }
  let timer = null;

  const write = (line) => target.write(line + '\n');

  const flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!pending) return;
    const { line, count } = pending;
    pending = null;
    write(count > 1 ? `${line}  ${c.yellow(`\u00D7${count}`)}` : line);
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, QUIET_MS);
    if (typeof timer.unref === 'function') timer.unref();
  };

  const handle = (line) => {
    const plain = line.replace(ANSI, '');
    if (!plain.includes('[audit]')) { flush(); write(line); return; }

    // Collapse only true repeats: same event, ip and path — ignoring the
    // clock and the retryAfter countdown, which tick on every request.
    const shape = plain
      .replace(/\d{2}:\d{2}:\d{2}/g, '')
      .replace(/=\d+s\b/g, '=*s')
      .trim();

    if (pending && pending.shape === shape) {
      pending.count += 1;
      schedule();
      return;
    }
    flush();
    pending = { line, shape, count: 1 };
    schedule();
  };

  return {
    push(chunk) {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        if (line.trim()) handle(line);
      }
      // A partial line is normal mid-chunk; keep it until its newline arrives.
    },
    flush,
  };
}

// ── port resolution ────────────────────────────────────────────────────────
function resolvePort() {
  const cli = process.argv.indexOf('--port');
  if (cli !== -1 && process.argv[cli + 1]) return Number(process.argv[cli + 1]);
  if (process.env.PORT) return Number(process.env.PORT);
  try {
    const envFile = path.join(APP_DIR, '.env.local');
    if (fs.existsSync(envFile)) {
      const line = fs.readFileSync(envFile, 'utf8')
        .split(/\r?\n/)
        .find((l) => /^\s*PORT\s*=/.test(l));
      if (line) return Number(line.replace(/^\s*PORT\s*=\s*/, '').trim());
    }
  } catch {
    /* fall through to default */
  }
  return 3001;
}

function pidsListeningOn(port) {
  if (!IS_WIN) return [];
  try {
    const out = execSync('netstat -ano -p TCP', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (
        parts.length >= 5 &&
        parts[0] === 'TCP' &&
        parts[3] === 'LISTENING' &&
        parts[1].endsWith(`:${port}`)
      ) {
        const pid = Number(parts[4]);
        if (pid && pid !== process.pid) pids.add(parts[4]);
      }
    }
    return [...pids];
  } catch {
    return [];
  }
}

function commandLineOf(pid) {
  if (!IS_WIN) return '';
  // wmic is deprecated/removed on newer Windows builds — use PowerShell CIM.
  const probes = [
    `powershell -NoProfile -NonInteractive -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`,
    `wmic process where (ProcessId=${pid}) get CommandLine /format:list`,
  ];
  for (const probe of probes) {
    try {
      const out = execSync(probe, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const text = out.trim();
      if (!text) continue;
      if (probe.includes('format:list')) {
        const m = text.match(/CommandLine=(.*)/s);
        if (m) return m[1].trim();
      }
      return text;
    } catch {
      /* try next probe */
    }
  }
  return '';
}

function isOurNextServer(pid, port) {
  const cmd = commandLineOf(pid).replace(/\//g, '\\').toLowerCase();
  if (!cmd) return false;
  const isNextServer = /next[\\/]dist[\\/](bin[\\/]next (dev|start)|server[\\/]lib[\\]start-server\.js)/
    .test(cmd);
  if (!isNextServer) return false;
  const app = APP_DIR.replace(/\//g, '\\').toLowerCase();
  return cmd.includes(app) || new RegExp(`-p ${port}\\b`).test(cmd);
}

function killPids(pids) {
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } catch {
      /* already gone – race is fine */
    }
  }
}

function waitPortFree(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const tick = () => {
      if (!pidsListeningOn(port).length) {
        resolve(true);
        return;
      }
      if (Date.now() > deadline) {
        resolve(false);
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

function shutdown(child) {
  child.kill('SIGTERM');
  setTimeout(() => child.kill('SIGKILL'), 3000);
}

/**
 * Split the launcher's own flags from the ones meant for Next.
 * Exported (with the helpers below) so the banner and the stderr pump can be
 * exercised without actually starting a server.
 */
function parseArgs(argv) {
  const modeArg = argv[2];
  const mode = modeArg === 'build' ? 'build' : modeArg === 'start' ? 'start' : 'dev';

  const extra = [];
  let hostArg;
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--port') { i += 1; continue; }
    if (arg.startsWith('--port=')) continue;
    if (arg === '-H' || arg === '--hostname') { hostArg = argv[i + 1]; i += 1; continue; }
    if (arg.startsWith('--hostname=')) { hostArg = arg.slice('--hostname='.length); continue; }
    extra.push(arg);
  }
  return { mode, extra, hostArg };
}

async function main() {
  const port = resolvePort();
  const { mode, extra, hostArg } = parseArgs(process.argv);

  // ── Step 2: free a stale Next.js server of this project holding the port ──
  const stale = pidsListeningOn(port).filter((pid) => isOurNextServer(pid, port));
  if (stale.length) {
    console.log(
      `[next-run] Port ${port} is held by a stale Next.js server (PID ${stale.join(', ')}). ` +
      'Terminating it and starting a fresh server…'
    );
    killPids(stale);
  }
  await waitPortFree(port, 4000);

  const stillHeld = pidsListeningOn(port);
  if (stillHeld.length) {
    console.error(
      `\n[next-run] Port ${port} is still occupied by another process (PID ${stillHeld.join(', ')}).\n` +
      'It is not a Next.js server of this project, so it was left untouched.\n' +
      `Free the port yourself, or launch on another one:\n  npm run dev -- --port 3002\n`
    );
    process.exit(1);
  }

  printBanner({ port, mode, hostname: resolveHostname(hostArg), hostArg });

  // ── Step 3: start Next as a child and mirror stdio ─────────────────────
  const args = [NEXT_BIN, mode];
  if (mode !== 'build') args.push('-p', String(port));
  args.push(...extra);

  const child = spawn(process.execPath, args, {
    cwd: APP_DIR,
    // stdout inherited: Next owns its progress rendering. stderr piped so the
    // [audit] burst-collapsing above can apply without touching it.
    stdio: ['inherit', 'inherit', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      // The edge runtime has no process.stdout, so the middleware cannot work
      // out whether a human is watching. It defaults to readable lines; this is
      // where that gets corrected to JSON for `npm run dev > log.txt`, and for
      // CI. An explicit value from the environment always wins.
      SECURITY_AUDIT_FORMAT:
        process.env.SECURITY_AUDIT_FORMAT || (process.stderr.isTTY ? 'pretty' : 'json'),
    },
  });

  const pump = createStderrPump(process.stderr);
  child.stderr.on('data', (chunk) => pump.push(chunk.toString()));

  child.on('exit', (code) => {
    // process.exit can truncate an in-flight stderr write, so drain first.
    if (child.stderr) child.stderr.removeAllListeners('data');
    pump.flush();
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => shutdown(child));
  process.on('SIGTERM', () => shutdown(child));
}

module.exports = { createStderrPump, printBanner, parseArgs, resolvePort, lanAddress };

// Only launch when run as the entry point — requiring this file must not start
// a server, kill a port or print a banner.
if (require.main === module) {
  main().catch((err) => {
    console.error('[next-run] failed to start:', err);
    process.exit(1);
  });
}
