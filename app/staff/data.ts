/**
 * app/staff/data.ts
 * Shared staff-area chrome: menu items and the dark surface tokens.
 *
 * The staff navbar is the PUBLIC navbar with a different item list — same
 * component, same animation, same markup (see StaffNavbar.tsx). Defining the
 * list here keeps it out of the client component so both the mobile drawer and
 * the desktop row read one source.
 */

export interface StaffNavItem {
  href: string;
  label: string;
  labelEn: string;
  /** Key into the icon set rendered by StaffNavbar. */
  icon: 'team' | 'chat' | 'rules' | 'profile';
}

export const STAFF_NAV_ITEMS: readonly StaffNavItem[] = [
  { href: '/staff/team', label: 'Nhân viên', labelEn: 'Team', icon: 'team' },
  { href: '/staff/chat', label: 'Chatbox Nội Bộ', labelEn: 'Internal Chat', icon: 'chat' },
  { href: '/staff/rules', label: 'Nội quy tuân thủ', labelEn: 'Compliance Rules', icon: 'rules' },
  { href: '/staff/profile', label: 'Trang cá nhân', labelEn: 'My Profile', icon: 'profile' },
] as const;