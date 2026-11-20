// app/api/staff/rules/route.ts
//   GET   → the rule text + whether THIS member has acknowledged it
//   POST  → record the acknowledgement
//
// The acknowledgement is stored twice: the timestamp on the staff record (who
// agreed, and when) and the VERSION they agreed to. Without the version, editing
// a typo would silently rewrite what people already signed — see
// lib/staffRules.ts for why `RULES_VERSION` exists.

import { NextResponse } from 'next/server';
import { requireStaffAction } from '@/lib/staffSession';
import { acknowledgeRules } from '@/lib/staff-service';
import { STAFF_RULES, RULES_VERSION, RULES_LAST_UPDATED, RULES_ITEM_COUNT } from '@/lib/staffRules';
import { dbRuleAcknowledgements, type RuleAcknowledgement } from '@/lib/dbRuleAcknowledgements';
import { audit } from '@/security/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await requireStaffAction('staff:rules');
  if ('error' in session) return session.error;

  const history = await dbRuleAcknowledgements.listForStaff(session.staff.id);
  const current: RuleAcknowledgement | undefined = history.find(
    (entry) => entry.version === RULES_VERSION
  );

  return NextResponse.json({
    sections: STAFF_RULES,
    version: RULES_VERSION,
    lastUpdated: RULES_LAST_UPDATED,
    itemCount: RULES_ITEM_COUNT,
    acknowledgedAt: current?.acknowledgedAt ?? null,
    /** How many previous versions this member has accepted. */
    history: history.map((entry) => ({ version: entry.version, acknowledgedAt: entry.acknowledgedAt })),
  });
}

export async function POST() {
  const session = await requireStaffAction('staff:rules');
  if ('error' in session) return session.error;

  const now = new Date().toISOString();

  // Idempotent: acknowledging twice in a day must not create two rows, or the
  // history view fills up with duplicates.
  const already = (await dbRuleAcknowledgements.listForStaff(session.staff.id)).find(
    (entry) => entry.version === RULES_VERSION
  );

  if (!already) {
    await dbRuleAcknowledgements.create({
      staffId: session.staff.id,
      staffName: session.staff.name,
      version: RULES_VERSION,
      acknowledgedAt: now,
    });
  }

  // Mirror onto the staff record so the profile page can show the date without a
  // second lookup, and carry the version so an edit to the rules re-opens the
  // acknowledgement for everyone who signed the previous one.
  await acknowledgeRules(session.staff.id, RULES_VERSION);

  await audit('STAFF_RULES_ACKNOWLEDGED', {
    email: session.staff.email,
    staffId: session.staff.id,
    detail: `rules v${RULES_VERSION}`,
  });

  return NextResponse.json({
    success: true,
    acknowledgedAt: already?.acknowledgedAt ?? now,
    version: RULES_VERSION,
    message: 'Đã ghi nhận. Cảm ơn bạn đã tuân thủ nội quy Belwee.',
  });
}