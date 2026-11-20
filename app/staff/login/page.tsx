import { ensureSeedStaff, getPinLockState } from '@/lib/staff-service';
import { getStaffSession } from '@/lib/staffSession';
import { redirect } from 'next/navigation';
import StaffAuthCard from '@/components/staff/StaffAuthCard';
// `AuthMode` comes from lib/staffShared, NOT from the "use client" card: a
// server component may only import *components* from a client module, and an
// enum is a runtime value. Importing it from there threw
// "Could not find the module ...StaffAuthCard.tsx#AuthMode#Login in the React
// Client Manifest" on every render of this page.
import { AuthMode } from '@/lib/staffShared';

export const dynamic = 'force-dynamic';

function safeNext(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  // Only internal staff paths — never an external URL or the login page itself.
  if (value.startsWith('//') || value.startsWith('http://') || value.startsWith('https://')) return null;
  if (!value.startsWith('/staff/')) return null;
  if (value.startsWith('/staff/login') || value.startsWith('/staff/register')) return null;
  return value;
}

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // Triggers first-run admin seeding when ALLOW_STAFF_SEED=true. No hardcoded
  // default PIN is ever shown — the seeded PIN is random and printed once to
  // the server console.
  await ensureSeedStaff();

  // An already-signed-in staff member has no business on the login card.
  const session = await getStaffSession();
  if (session) redirect('/staff/dashboard');

  const next = safeNext(searchParams?.next);
  // `locked` lets the card start in the disabled state on a hard refresh, so a
  // locked account does not look usable until the first rejected attempt.
  const lockedEmail = typeof searchParams?.email === 'string' ? searchParams.email : '';
  const lock = lockedEmail ? getPinLockState(lockedEmail) : { locked: false, retryAfterSeconds: 0 };

  return (
    <StaffAuthCard
      mode={AuthMode.Login}
      nextRedirect={next}
      initialLock={lock}
    />
  );
}