# Staff portal — known limitations and open findings

Companion to [`staff-rbac.md`](./staff-rbac.md) (who may do what). This file records
what the code **cannot** currently guarantee, so nobody mistakes "the tests pass"
for "this is airtight".

Ordered by how much it matters in production.

---

## 1. Logout does not revoke the session — cookie is cleared, token stays valid

**Severity: high. Unfixed — needs a design decision.**

`POST /api/staff/logout` calls `clearStaffSessionCookie()`, which only sets an
expiring cookie. The session itself is a stateless HMAC token
(`lib/staffSession.ts`, `SESSION_TTL_MS = 12h`) with **no server-side
revocation list**. Nothing anywhere records that a given token was invalidated.

Evidence — `verify-route-and-logout.cjs` logs in, logs out, then replays the
cookie value it captured beforehand:

```
PASS  POST /api/staff/logout succeeds
PASS    it expires the session cookie
FAIL    the old cookie no longer authenticates  -> 200
```

Consequence: a staff cookie that leaks (XSS, shared machine, proxy log, a
screenshot of a devtools panel) stays usable for up to **12 hours** after the
user believes they have signed out. Re-setting the cookie in a browser is all it
takes.

### Options, and why it is not a one-liner

| Approach | Effect | Cost / drawback |
|---|---|---|
| Per-staff `sessionsValidAfter` timestamp in `data/staff.json`; logout bumps it | Logout kills every device for that staff | Signs out the vet at the front desk when they log out on their phone. Simple, survives restart. |
| Short-lived access token + rotating refresh token | Proper per-device revocation | Needs new storage and a refresh endpoint. Too much for a single-clinic tool. |
| In-memory revocation `Set` (same pattern as the rate limiter) | Per-token logout, cheap | **Lost on restart**, and useless the moment this runs on more than one instance — which is the same trap as finding 2. |

The recommendation is the first row: one extra timestamp per staff, honest
"logout logs out all devices" semantics, no new infrastructure. **It has not
been implemented** because it changes data/ behaviour and needs sign-off.

---

## 2. Rate limiting and the PIN step-guard are in-memory only

`security/rateLimit` and the `stepGuard` `Map` in `lib/staffSession.ts` both live
in the Node process.

- **Single instance only.** Two instances behind a load balancer give every
  visitor two independent budgets, so the effective limit doubles. A
  multi-instance deploy needs Redis / Upstash / Vercel KV.
- **Lost on restart.** A deploy or crash resets every counter, and clears
  `stepGuard`, which is what stops a stolen `stepToken` from being brute-forced
  across a restart.

Neither blocks a single-instance deployment today. Both need a shared store
before this scales out.

---

## 3. Session TTL is absolute 12h with no sliding refresh

`SESSION_TTL_MS` is checked at issue time and never extended. A nurse who logs in
at 08:00 and works a 12-hour shift is logged out at 20:00 mid-task, with no
warning and no graceful expiry — the next API call just returns 401 and the UI
has to notice. Sliding renewal (extend on activity, cap the total) is a small
change; it is listed here so the abrupt logout is a known behaviour rather than a
surprise.

---

## 4. `CSRF_REJECTED` and `RATE_LIMITED` never reach `data/logs/`

Both events are produced in `middleware.ts`, which runs on the **edge** runtime
and has no `fs`. They are emitted through `security/audit-edge.ts`, which writes
to the console only. Every other event goes through `security/audit.ts` and is
persisted.

Practical effect: `data/logs/audit.jsonl` has no record of rejected cross-site
submissions or throttled clients. If you need that trail, the events have to be
forwarded — `console.log` from a serverless function lands in the platform's
log drain, not on disk.

---

## 5. Real secrets still live in `.env.local`

`.env.local` is gitignored and was cleaned of the plaintext `STAFF_INIT_PASSWORD`
/ `STAFF_INIT_PIN` and the duplicated `ALLOW_STAFF_SEED`. It still contains live
values for `EMAIL_PASS` (a Gmail app password) and `GOOGLE_CLIENT_SECRET`.

Do not commit it and do not paste it into issues or chat. Rotate both if this
repository has ever been pushed anywhere public.

---

## Verification status

Machine-readable proof lives in the `verify-*.cjs` scripts. What each one
currently covers, and what it does not:

| Script | Assertions | Covers |
|---|---|---|
| `verify-rbac.cjs` | 23 | role matrix, deny-by-default, per-field PATCH gating, `pin:true` assertion, step-token rejection |
| `verify-staff2.cjs` | 22 | appointment state machine, receipt guards, diagnosis-on-cancelled, unauthenticated 401s |
| `verify-files2.cjs` | 13 | file ownership (200 for owner, 404 for non-owner), path traversal |
| `verify-chrome-gate.cjs` | 10 | staff pages carry no site chrome; homepage does (negative control) |
| `verify-route-and-logout.cjs` | 9 | route protection, login handshake, logout — **and the finding in §1** |
| `verify-record-fix.cjs` | 7 | record binding for the diagnosis-on-cancelled path |

**The last full `next build` + full-suite pass predates the record-binding fix.**
The build on this machine is currently blocked (see the note below), so the
post-fix state has been verified against a `next dev` server, not a production
build. Re-run everything against a production build before deploying.

### Why the build is blocked

This machine has 7.7 GB RAM with ~1 GB free (VS Code, Avast, Zalo and others
hold ~14 GB of private memory). `next build` is OOM-killed during the webpack
compile — it dies silently right after `Creating an optimized production
build`, leaving a `.next` with no `BUILD_ID`. Tighter heaps
(`--max-old-space-size=1400`) do not help; the constraint is physical memory, not
the V8 limit.

`next dev` runs, but is not a trustworthy substitute under this pressure: it
drops requests, returns spurious 404s, and logs
`Failed to generate static paths ... Cannot read properties of undefined` for
dynamic API routes. Some of the suites pass against it anyway, but a flaky
substrate is not evidence.

Close some applications and re-run:

```bash
npx next build
npx next start -p 3999
node verify-rbac.cjs            http://localhost:3999
node verify-staff2.cjs          http://localhost:3999
node verify-files2.cjs          http://localhost:3999
node verify-chrome-gate.cjs     http://localhost:3999
node verify-route-and-logout.cjs http://localhost:3999
node verify-record-fix.cjs      http://localhost:3999
```

**Restart the server between suites.** The rate limiter is in-memory (finding 2),
so a single process cannot absorb all of them; the second suite onward gets
`429 Bạn gửi quá nhiều yêu cầu`.
