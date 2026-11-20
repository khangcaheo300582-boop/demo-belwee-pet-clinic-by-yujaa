"use client";

import { SessionProvider } from "next-auth/react";
import { signOut, useSession } from "next-auth/react";
import { MotionConfig } from "framer-motion";
import React, { useEffect, useRef } from "react";
import { CUSTOMER_IDLE_TIMEOUT_MS, SESSION_ACTIVITY_REFRESH_MS } from "@/lib/session-policy";

function CustomerSessionActivity() {
  const { data: session, status, update } = useSession();
  const refreshingRef = useRef(false);
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    if (status !== "authenticated") return;

    const expireSession = () => {
      void signOut({ callbackUrl: "/dang-nhap" });
    };
    const expiresAt = new Date(session.expires).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      expireSession();
      return;
    }

    const expiryTimer = window.setTimeout(
      expireSession,
      Math.min(expiresAt - Date.now(), CUSTOMER_IDLE_TIMEOUT_MS)
    );

    const recordActivity = () => {
      const now = Date.now();
      if (now >= expiresAt) {
        expireSession();
        return;
      }
      if (refreshingRef.current || now - lastRefreshRef.current < SESSION_ACTIVITY_REFRESH_MS) return;
      refreshingRef.current = true;
      void update({ activity: true })
        .then((nextSession) => {
          if (!nextSession?.user?.email || new Date(nextSession.expires).getTime() <= Date.now()) {
            expireSession();
          } else {
            lastRefreshRef.current = Date.now();
          }
        })
        .catch(() => {
          lastRefreshRef.current = 0;
        })
        .finally(() => {
          refreshingRef.current = false;
        });
    };

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "wheel"];
    for (const eventName of events) window.addEventListener(eventName, recordActivity, { passive: true });

    return () => {
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      for (const eventName of events) window.removeEventListener(eventName, recordActivity);
    };
  }, [session, status, update]);

  return null;
}

/**
 * Motion is unconditional across the app.
 *
 * framer-motion already defaults to reducedMotion: "never" (see the
 * MotionConfigContext in its dist bundle), so it was not gating animations on
 * the OS setting to begin with. Stating it explicitly is what makes the intent
 * durable: a future edit that flips this to "user" would otherwise re-enable
 * the gating with nothing in review to catch it.
 *
 * This does NOT affect the `useReducedMotion()` hook, which is a raw
 * media-query read and ignores this config entirely — LiquidGlassCard used that
 * hook and now calls lib/motion.ts instead.
 *
 * Deliberately wrapped around the whole <body> rather than inside
 * AuthProvider: the intro video, quiet preloader, route-skeleton overlay and
 * the mesh backdrop all animate and all sit above AuthProvider in the tree.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  // Force tắt toàn bộ animation framer-motion, bất kể cài đặt OS.
  return <MotionConfig reducedMotion="never">{children}</MotionConfig>;
}

/**
 * Session refetching is deliberately dialled down.
 *
 * Defaults cost far more than they look: next-auth refetches the session both
 * on window focus and on tab visibility change, on top of the mount fetch.
 * Alt-tabbing between the browser and the dev terminal — the normal rhythm of
 * working on this app — therefore produced a steady stream of
 * /api/auth/session calls, which is what kept tripping the middleware rate
 * limit and filling the terminal with RATE_LIMITED.
 *
 * Session checks remain quiet while idle. CustomerSessionActivity refreshes the
 * signed JWT only after real user input, extending its three-day idle deadline;
 * the JWT callback rejects an expired activity timestamp on the server.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <CustomerSessionActivity />
      {children}
    </SessionProvider>
  );
}
