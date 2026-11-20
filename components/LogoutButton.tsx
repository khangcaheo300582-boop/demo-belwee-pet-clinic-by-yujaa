'use client';

// components/LogoutButton.tsx
// Logout button for the staff portal.
//
// Root cause of the old 3000→3001 redirect bug: some flows passed absolute
// URLs derived from NEXTAUTH_URL into navigation. This component never does —
// it clears the staff session cookie via a *relative* fetch, then navigates
// with a relative path, so the browser always stays on the origin it came from.
//
// WHERE IT LANDS
//   Default: "/" — the public homepage. The requirement is that signing out of
//   the staff portal returns the employee to the customer site, not to another
//   staff page. `/staff/login` is reachable directly whenever it is needed, and
//   it is also where an expired session lands.

import { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoutButtonProps {
  className?: string;
  label?: string;
  /**
   * Rendered in the navbar actions row (pill, icon-only) or as a full button
   * inside the mobile menu drawer footer.
   */
  compact?: boolean;
  variant?: 'navbar' | 'menu';
  /** Where to go after the session is destroyed. Relative on purpose. */
  redirectTo?: string;
}

export default function LogoutButton({
  className,
  label = 'Thoát',
  compact = false,
  variant = 'menu',
  redirectTo = '/',
}: LogoutButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      // Relative URL on purpose — never window.location.origin, never
      // NEXTAUTH_URL, never an absolute http://localhost:PORT string.
      await fetch('/api/staff/logout', { method: 'POST' });
    } catch {
      // Even if the request fails (offline, server restart), still navigate —
      // the cookie will be treated as invalid by every protected route anyway.
    } finally {
      // `location.assign` (not router.push) so the in-memory React tree is torn
      // down. A client-side navigation would keep the previous page's staff
      // data mounted for a frame, briefly showing the queue after logout.
      window.location.assign(redirectTo);
    }
  }

  const shared =
    'flex items-center justify-center gap-2 font-semibold backdrop-blur-xl transition-colors disabled:opacity-60';

  if (compact && variant === 'navbar') {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={busy}
        aria-label={busy ? 'Đang thoát' : 'Thoát khỏi cổng nhân viên'}
        title={label}
        className={cn(
          shared,
          'size-9 rounded-full border border-red-300/25 bg-red-500/12 text-red-200 hover:bg-red-500/25',
          className
        )}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LogOut className="size-4" />
        )}
      </button>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={busy}
        className={cn(
          shared,
          'w-full rounded-full border border-red-300/25 bg-red-500/12 px-4 py-2 text-xs text-red-200 hover:bg-red-500/25',
          className
        )}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
        {busy ? 'Đang thoát…' : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className={cn(
        shared,
        'rounded-full border border-red-300/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/20',
        className
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      {busy ? 'Đang thoát…' : label}
    </button>
  );
}