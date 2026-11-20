'use client';

// components/staff/StaffNavbar.tsx
// The staff navbar: the PUBLIC navbar with a different menu.
//
// There is no second navbar implementation. This wraps components/SiteNavbar
// and passes four items, so the glass-on-scroll behaviour, the hover pill, the
// hamburger card's clip-path reveal, the stagger entrance and the focus trap
// are literally the same code the customer sees — which is what keeps the two
// from drifting apart over time.

import SiteNavbar, { type NavItem } from '@/components/SiteNavbar';
import LogoutButton from '@/components/LogoutButton';
import { STAFF_NAV_ITEMS } from '@/app/staff/data';

export default function StaffNavbar() {
  const items: readonly NavItem[] = STAFF_NAV_ITEMS.map((item) => ({
    href: item.href,
    route: item.href,
    label: item.label,
  }));

  return (
    <SiteNavbar
      sticky
      items={items}
      // The customer account/login entry is meaningless inside the portal.
      showAccountItem={false}
      ctaHref="/staff/dashboard"
      ctaLabel="Bảng điều khiển"
      emergencyHref={null}
      emergencyLabel="Nội bộ"
      emergencyAria="Khu vực nội bộ Belwee"
      footerSlot={<LogoutButton compact />}
      actionsSlot={<LogoutButton compact variant="navbar" />}
    />
  );
}