import type { NextRequest } from 'next/server';

/**
 * CSRF defence for the application.
 *
 * Strategy (belt + braces, all stateless/edge-safe):
 *   1. SameSite=Lax on session cookies (see lib/staffSession.ts) — blocks the
 *      most dangerous cross-site top-level form posts.
 *   2. Same-origin Origin check for every mutating method (see security/request.ts).
 *   3. Sec-Fetch-Site enforcement below: modern browsers tag every request with
 *      Sec-Fetch-Site. An attacker's cross-site submission is tagged
 *      "cross-site" and we reject it for mutating methods. Attackers cannot
 *      forge this header from HTML forms, so it is a strong, dependency-free
 *      CSRF control whenever the browser supports it.
 *
 * Requests that do not send Sec-Fetch-Site (very old clients / non-browser
 * callers such as the cron endpoint) are handled by the Origin check that runs
 * before this function in middleware.ts.
 */

/** True when the request is a strongly-typed cross-site browser submission. */
export function isCrossSiteFetch(request: NextRequest): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (!site) return false; // header absent → not enforceable here, rely on Origin.
  return site === 'cross-site';
}

/**
 * Return an error description when a mutating request is a cross-site browser
 * submission, otherwise null.
 */
export function csrfErrorForMutatingRequest(request: NextRequest): string | null {
  if (isCrossSiteFetch(request)) {
    return 'Nguồn yêu cầu không được phép (CSRF).';
  }
  return null;
}
