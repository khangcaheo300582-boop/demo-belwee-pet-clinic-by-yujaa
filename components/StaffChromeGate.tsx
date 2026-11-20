"use client";

// components/StaffChromeGate.tsx
// The staff portal renders its own full-bleed dark UI (StaffDashboard,
// StaffLoginClient) and must NOT inherit the public site chrome: the marketing
// navbar, the footer, the intro video and the floating contact widget all sit in
// app/layout.tsx, which is a single root layout for the whole app.
//
// A nested app/staff/layout.tsx cannot remove them — nested layouts render
// INSIDE <main>, they cannot reach their parent's siblings. So the decision is
// made here instead, with usePathname().
//
// Why this matters beyond cosmetics: <IntroVideo> plays a fullscreen overlay
// video, and SiteNavbar exposes the customer account menu. A staff member who
// opens /staff/dashboard in a new tab gets a marketing video over the queue and
// a logout-able customer session one click away.

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function StaffChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isStaffArea = typeof pathname === 'string' && pathname.startsWith('/staff');
  if (isStaffArea) return null;
  return <>{children}</>;
}
