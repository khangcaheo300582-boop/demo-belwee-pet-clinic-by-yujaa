// app/staff/layout.tsx
// Boundary for the internal staff portal.
//
// This layout cannot strip the site chrome out of app/layout.tsx (a nested
// layout renders inside <main>) — components/StaffChromeGate.tsx does that via
// usePathname(). What this layout owns is the portal's own concerns:
//
//   1. noindex — /staff/** is an authenticated internal tool. It must never
//      appear in a search index or in an AI answer.
//   2. no caching — every staff page reads live booking data, so a shared or
//      browser-cached copy would show a stale queue to a receptionist.
//   3. the staff navbar — the PUBLIC navbar with four different items, so the
//      two areas can never drift apart visually (components/staff/
//      StaffChromeBoundary.tsx adds it, skipping the two auth pages).

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import StaffChromeBoundary from '@/components/staff/StaffChromeBoundary';

export const metadata: Metadata = {
  title: 'Cổng nhân viên · Belwee Pet Clinic',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#070b16]">
      <StaffChromeBoundary>{children}</StaffChromeBoundary>
    </div>
  );
}