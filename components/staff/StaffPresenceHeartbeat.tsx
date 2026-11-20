'use client';

// components/staff/StaffPresenceHeartbeat.tsx
// Keeps lib/dbPresence "who is online" truthful for customer-care assignment.
//
// Mounted by StaffChromeBoundary on every protected /staff page — login pages
// are excluded there, so only signed-in members beat. Online-status is decided
// server-side by ONLINE_TTL_SECONDS, this component only sends the beat.

import { useEffect, useRef } from 'react';

export default function StaffPresenceHeartbeat() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;

    const beat = async () => {
      if (!alive) return;
      try {
        // A 401 simply means the idle timeout hit and the chrome redirected;
        // the next sign-in resumes the beat.
        await fetch('/api/staff/presence', { method: 'POST', cache: 'no-store' });
      } catch {
        /* offline for a moment — the next beat repairs the record */
      }
    };

    void beat();
    intervalRef.current = setInterval(() => {
      void beat();
    }, 30_000);

    return () => {
      alive = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return null;
}
