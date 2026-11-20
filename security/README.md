# Belwee security layer

The `security/` module is the shared edge-safe protection layer used by
`middleware.ts`. It applies security headers, same-origin checks for browser
mutations, request-size limits, and per-IP rate limits before requests reach
pages or API handlers.

Set `SECURITY_TRUSTED_ORIGINS` to a comma-separated list of additional trusted
origins when a separate trusted frontend or reverse proxy must call the API.
For production, also set strong random values for `NEXTAUTH_SECRET`,
`STAFF_SESSION_SECRET`, and `CRON_SECRET`; never use the development defaults.

The in-memory limiter protects a single Node.js instance. A multi-instance
deployment should put a shared rate limiter (for example Redis or an edge
provider) in front of the application as well.

## Rate-limit buckets

Per IP, in `config.ts`. The split matters: a bucket must be sized for what the
endpoint *is*, not for the whole API surface.

| Bucket     | Limit      | Endpoints |
| ---------- | ---------- | --------- |
| `global`   | 300 / min  | every `/api/*` request, on top of its own bucket |
| `session`  | 240 / min  | `/api/auth/session`, `csrf`, `providers`, `_log` |
| `auth`     | 12 / min   | staff login, register, password reset, signin / signout / callback |
| `otp`      | 5 / 10 min | every OTP endpoint |
| `booking`  | 20 / min   | `/api/booking` |
| `upload`   | 30 / min   | `/api/staff/upload` |

`session` exists because the browser calls `/api/auth/session` on its own —
SessionProvider mount, window focus, tab visibility — several times per page
load. Folding those reads into the 12/min `auth` bucket meant a normal dev
session, and any client on a slow connection, got 429 on its own login state.

## Origin checks

`hasTrustedOrigin` is strict, and identical in development and production. It
accepts the request's own origin, any origin in `NEXTAUTH_URL` /
`NEXT_PUBLIC_BASE_URL` / `SECURITY_TRUSTED_ORIGINS`, and the same site recovered
from `X-Forwarded-Proto` + `X-Forwarded-Host`.

`originRejection` wraps that with one development-only relaxation, for the case
a local proxy or tunnel makes the two impossible to reconcile: the browser's
origin is the tunnel's public name while the app only ever sees its own
internal address, often with `X-Real-IP` set and `X-Forwarded-Host` absent.
There, a mismatched `Origin` is treated as a configuration gap rather than an
attack — but only when the browser reports `Sec-Fetch-Site` as `same-origin`,
`same-site` or `none`.

The layering is deliberate. `Sec-Fetch-Site` is the control that actually
decides CSRF and it cannot be forged by a form or a scripted request from
another site, so an explicit `cross-site` is refused before any relaxation
applies, in every mode. A request with no `Sec-Fetch-Site` at all is a
hand-rolled client; those are allowed only on the same loopback port, which
keeps `curl` and Postman usable against the dev server.

Production applies no relaxation at all — set `SECURITY_TRUSTED_ORIGINS` instead.

Rejections are logged with the received `Origin` and `Host`, so telling a real
attack apart from a misconfigured proxy does not require guesswork.

## Audit output

`RATE_LIMITED` and `CSRF_REJECTED` are emitted by the middleware on the edge
runtime, so they reach the platform log only — they do not land in
`data/logs/audit-<date>.log`. `security/audit.ts` (Node) does write the file.

- Human-readable and colourised by default, one aligned line per event.
- The edge sandbox has no `process.stdout`, so it cannot detect a terminal
  itself; `npm run dev` sets `SECURITY_AUDIT_FORMAT` from the real stderr TTY.
  `SECURITY_AUDIT_FORMAT=json` forces machine-readable output for pipelines.
- `SECURITY_AUDIT_COLOR=0` disables ANSI codes.
- `npm run dev` additionally collapses consecutive identical lines into `×N`.
