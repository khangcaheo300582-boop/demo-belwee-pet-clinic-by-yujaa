import { NextResponse } from 'next/server';
import { auditEdge } from '@/security/audit-edge';
import { clientIpFrom } from '@/security/audit';

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid report.' }, { status: 400 });
  }

  // Log CSP violation via edge audit
  try {
    const csp = (body as { 'csp-report'?: any } | null)?.['csp-report'] ?? body;
    auditEdge('CSRF_REJECTED', {
      ip,
      detail: `CSP violation: ${csp?.['blocked-uri']} on ${csp?.['document-uri']}`,
    });
  } catch {
    // Silent — never break the client on reporting errors
  }

  // Return 204 No Content per CSP reporting spec
  return new NextResponse(null, { status: 204 });
}
