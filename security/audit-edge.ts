// security/audit-edge.ts
// Edge-safe audit sink for middleware.ts.
//
// `security/audit.ts` writes to data/logs with fs/promises, which does not exist
// on the edge runtime. Importing it from middleware would break the edge bundle,
// so the RATE_LIMITED / CSRF_REJECTED events that only middleware can observe
// are emitted here instead.
//
// Consequence, stated plainly: these two events reach the platform log via
// console.warn but NOT data/logs/audit-<date>.log. That is a deliberate
// limitation, not an oversight — if you later move rate limiting into a Node
// route handler, switch those call sites back to audit().
//
// `import type` is erased at compile time, so importing AuditEvent from
// ./audit does not pull `fs` into the edge bundle.

import type { AuditEvent, AuditFields } from './audit';

/** One line, one event — nothing is batched or dropped here. Presentation
 *  (collapsing repeats) is the dev launcher's job, not the security layer's. */

const SEVERITY_WIDTH = 14; // 'CSRF_REJECTED'.length

interface Style {
  dim(text: string): string;
  bold(text: string): string;
  warn(text: string): string;
  danger(text: string): string;
  reset: string;
}

function resolveColor(): Style {
  const enabled =
    process.env.SECURITY_AUDIT_COLOR !== '0' &&
    process.env.NO_COLOR === undefined &&
    process.env.FORCE_COLOR !== '0';

  if (!enabled) {
    const plain = (text: string) => text;
    return { dim: plain, bold: plain, warn: plain, danger: plain, reset: '' };
  }

  return {
    dim: (text) => `\u001b[2m${text}\u001b[22m`,
    bold: (text) => `\u001b[1m${text}\u001b[22m`,
    warn: (text) => `\u001b[33m${text}\u001b[39m`,
    danger: (text) => `\u001b[31m${text}\u001b[39m`,
    reset: '\u001b[0m',
  };
}

/**
 * A hijacked session is worse than a throttled one, so the two events
 * middleware can see are not treated as equal.
 */
const SEVERITY: Partial<Record<AuditEvent, { icon: string; paint: (s: string) => string }>> = {
  RATE_LIMITED: { icon: '\u26A0', paint: (s) => `\u001b[33m${s}\u001b[39m` },
  CSRF_REJECTED: { icon: '\u2716', paint: (s) => `\u001b[31m${s}\u001b[39m` },
};

/**
 * Pick the output format.
 *
 * Only the environment can decide this. The obvious check —
 * `process.stdout.isTTY` — is unavailable here: this module runs in the
 * middleware edge sandbox, where `process.stdout` does not exist, so an
 * in-process TTY probe silently always answered "no" and every line came out
 * as raw JSON. The launcher knows whether a terminal is attached (its stderr
 * is inherited from yours) and sets SECURITY_AUDIT_FORMAT accordingly, so the
 * default here is the human-readable one.
 *
 * SECURITY_AUDIT_FORMAT=json forces machine-readable output for log pipelines.
 */
function wantsJson(): boolean {
  return process.env.SECURITY_AUDIT_FORMAT === 'json';
}

export function auditEdge(event: AuditEvent, opts: AuditFields = {}): void {
  const iso = new Date().toISOString();

  if (wantsJson()) {
    console.warn(
      `[audit] ${JSON.stringify({
        ts: iso,
        event,
        ...(opts.ip ? { ip: opts.ip } : {}),
        ...(opts.email ? { email: opts.email } : {}),
        ...(opts.staffId ? { staffId: opts.staffId } : {}),
        ...(opts.detail ? { detail: opts.detail } : {}),
      })}`,
    );
    return;
  }

  const c = resolveColor();
  const severity = SEVERITY[event] ?? { icon: '\u2022', paint: (s: string) => s };
  const fields = [
    c.dim(iso.slice(11, 19)),
    // Kept as a literal tag: `[audit]` is what people grep for in a terminal
    // or a piped log, and what the dev launcher keys its repeat-collapsing off.
    c.dim('[audit]'),
    severity.paint(severity.icon),
    c.bold(event.padEnd(SEVERITY_WIDTH)),
    opts.ip ? c.dim(opts.ip.padEnd(15)) : '',
    opts.detail ? c.dim(opts.detail) : '',
  ].filter(Boolean);

  console.warn(`${fields.join('  ')}${c.reset}`);
}
