'use client';

import { useEffect } from 'react';
import { SESSION_ACTIVITY_REFRESH_MS, STAFF_IDLE_TIMEOUT_MS } from '@/lib/session-policy';

export default function StaffSessionActivity() {
  useEffect(() => {
    let lastActivity = Date.now();
    let lastRefresh = 0;
    let expired = false;
    let expiryTimer: number | undefined;

    const logout = () => {
      if (expired) return;
      expired = true;
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      void fetch('/api/staff/logout', { method: 'POST', keepalive: true })
        .catch(() => undefined)
        .finally(() => window.location.assign('/staff/login'));
    };

    const scheduleExpiry = () => {
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      expiryTimer = window.setTimeout(
        logout,
        Math.max(0, lastActivity + STAFF_IDLE_TIMEOUT_MS - Date.now())
      );
    };

    const refreshSession = () => {
      const now = Date.now();
      if (expired || now - lastActivity >= STAFF_IDLE_TIMEOUT_MS) {
        logout();
        return;
      }
      lastActivity = now;
      try {
        localStorage.setItem('belwee-staff-last-activity', String(now));
      } catch {
        // In-memory idle enforcement still works when browser storage is unavailable.
      }
      scheduleExpiry();
      if (now - lastRefresh < SESSION_ACTIVITY_REFRESH_MS) return;
      lastRefresh = now;
      void fetch('/api/staff/activity', { method: 'POST' })
        .then((response) => {
          if (!response.ok) logout();
        })
        .catch(() => {
          lastRefresh = 0;
        });
    };

    const syncActivity = (event: StorageEvent) => {
        if (event.key !== 'belwee-staff-last-activity' || !event.newValue) return;
        const sharedActivity = Number(event.newValue);
        if (!Number.isFinite(sharedActivity) || Date.now() - sharedActivity >= STAFF_IDLE_TIMEOUT_MS) return;
        if (sharedActivity > lastActivity) {
          lastActivity = sharedActivity;
          scheduleExpiry();
        }
    };

    const onVisibilityChange = () => {
        if (!document.hidden) refreshSession();
    };

    scheduleExpiry();
    refreshSession();
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    for (const eventName of events) window.addEventListener(eventName, refreshSession, { passive: true });
    window.addEventListener('storage', syncActivity);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
        if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
        for (const eventName of events) window.removeEventListener(eventName, refreshSession);
        window.removeEventListener('storage', syncActivity);
        document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return null;
}
