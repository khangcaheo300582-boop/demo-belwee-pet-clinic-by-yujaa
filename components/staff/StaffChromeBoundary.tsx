'use client';

// components/staff/StaffChromeBoundary.tsx
// Adds the sticky staff navbar and idle-session guard to protected /staff pages.
//
// Why a client component: the decision is "is this URL /staff/login or
// /staff/register?", and a server layout has no access to the pathname. The
// original code instead suppressed the PUBLIC navbar for the whole /staff
// prefix, which left the portal with no navigation at all — the four staff
// pages could only be reached by typing URLs.
//
// The two auth pages are excluded because StaffAuthCard paints its own
// full-bleed backdrop; a floating navbar over it offers destinations that lead
// straight back into a login wall.

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import StaffNavbar from '@/components/staff/StaffNavbar';
import StaffSessionActivity from '@/components/staff/StaffSessionActivity';
import CustomerRequestNotification from '@/components/staff/CustomerRequestNotification';
import StaffCustomerCareCard from '@/components/staff/StaffCustomerCareCard';
import StaffPresenceHeartbeat from '@/components/staff/StaffPresenceHeartbeat';

const AUTH_PAGES = ['/staff/login', '/staff/register', '/staff/forgot-pin'];

export default function StaffChromeBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = typeof pathname === 'string' && AUTH_PAGES.includes(pathname);

  if (isAuthPage) return <>{children}</>;

  return (
    <>
      <CustomerRequestNotification />
      <StaffCustomerCareCard />
      <StaffPresenceHeartbeat />
      <StaffSessionActivity />
      <StaffNavbar />
      {children}
    </>
  );
}