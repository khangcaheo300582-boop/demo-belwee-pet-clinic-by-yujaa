'use client';

// components/NotificationToggle.tsx
// Opt-in switch for booking-status notifications.
//
// THREE STATES, NOT TWO
//   The browser permission can be "denied" while the customer has never been
//   asked — and a toggle cannot express that on its own. So the component
//   distinguishes "off", "on but the browser will block it", and "on and
//   working", and says which one it is. A two-state switch that silently fails
//   to deliver is worse than no switch: the customer believes they will hear
//   about their pet's appointment and will not.
//
// PERMISSION FLOW
//   Notification.requestPermission() MUST be called from inside a user gesture.
//   Toggling "on" is that gesture. Note that iOS Safari only grants it for a
//   PWA installed to the home screen, so the disabled-but-explained state is a
//   real one to design for, not a hypothetical.

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, BellOff, Loader2, Smartphone, TriangleAlert } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { cn } from '@/lib/utils';

type Permission = 'granted' | 'denied' | 'default' | 'unsupported';

interface Props {
  /** Server-side opt-in state, hydrated from the API. */
  initialEnabled: boolean;
  /** Compact pill for the booking form vs a full card for the profile page. */
  variant?: 'card' | 'inline';
  className?: string;
  onChange?: (enabled: boolean) => void;
}

function readPermission(): Permission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export default function NotificationToggle({
  initialEnabled,
  variant = 'card',
  className,
  onChange,
}: Props) {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [permission, setPermission] = useState<Permission>('default');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPermission(readPermission());
  }, []);

  /**
   * Ask the browser, then persist.
   *
   * The server write happens even when the browser refuses: the customer has
   * still expressed an intent, and the profile page uses it to show the
   * "browser is blocking us" state instead of silently reverting the switch.
   */
  const persist = useCallback(
    async (next: boolean) => {
      setBusy(true);
      setMessage(null);
      try {
        const res = await fetch('/api/bookings/notifications/preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: next }),
        });
        if (!res.ok) throw new Error(t('notify.errSave'));
        setEnabled(next);
        onChange?.(next);
        return true;
      } catch (e) {
        setMessage(e instanceof Error ? e.message : t('notify.errSave'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onChange, t]
  );

  const toggle = useCallback(async () => {
    if (busy) return;
    setMessage(null);

    if (!enabled) {
      const current = readPermission();
      if (current === 'denied') {
        // The browser will not re-prompt. Say so plainly instead of flicking the
        // switch on and delivering nothing.
        setPermission('denied');
        setMessage(t('notify.errDenied'));
        await persist(true);
        return;
      }
      if (current === 'unsupported') {
        setPermission('unsupported');
        setMessage(t('notify.errUnsupported'));
        await persist(true);
        return;
      }
      // Ask first — a denied request cannot be re-asked, so persisting "on"
      // before the answer would leave a switch that promises and cannot deliver.
      let granted = false;
      try {
        granted = (await Notification.requestPermission()) === 'granted';
      } catch {
        granted = false;
      }
      setPermission(readPermission());
      await persist(true);
      if (!granted) {
        setMessage(t('notify.errSavedButBlocked'));
      }
      return;
    }

    await persist(false);
  }, [busy, enabled, persist, t]);

  const blocked = enabled && (permission === 'denied' || permission === 'unsupported');

  const shell =
    variant === 'inline'
      ? 'inline-flex items-center gap-2.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors'
      : 'flex items-start gap-3 rounded-2xl border p-4';

  const blockedState = blocked
    ? 'border-amber-300/30 bg-amber-400/10'
    : enabled
      ? 'border-emerald-300/30 bg-emerald-400/10'
      : 'border-white/15 bg-white/[0.05]';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        role="switch"
        aria-checked={enabled}
        aria-label={t('notify.aria')}
        className={cn(
          shell,
          blockedState,
          'text-left backdrop-blur-2xl transition-all hover:bg-white/[0.08] active:scale-[0.99] disabled:opacity-60'
        )}
      >
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-xl',
            variant === 'inline' ? 'size-7' : 'size-10',
            enabled
              ? 'bg-emerald-400/20 text-emerald-200'
              : 'bg-white/8 text-white/45'
          )}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : enabled ? (
            <BellRing className="size-4" />
          ) : (
            <BellOff className="size-4" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="block text-sm font-bold text-white">
              {enabled ? t('notify.labelOn') : t('notify.labelOff')}
            </span>
            {blocked && (
              <TriangleAlert
                className="size-3.5 shrink-0 text-amber-300"
                aria-label={t('notify.blockedAria')}
              />
            )}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-white/50">
            {enabled
              ? blocked
                ? t('notify.descOnBlocked')
                : t('notify.descOn')
              : t('notify.descOff')}
          </span>
        </span>

        {/* The switch track. Purely decorative — the whole button is the
            control, so the track is aria-hidden and the state lives on the
            button's role="switch". */}
        <span
          aria-hidden="true"
          className={cn(
            'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-300',
            enabled ? 'border-emerald-300/50 bg-emerald-400/40' : 'border-white/20 bg-white/10'
          )}
        >
          <motion.span
            layout
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className={cn(
              'absolute top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full text-[9px] shadow-md',
              enabled ? 'right-1 bg-emerald-200' : 'left-1 bg-white/70'
            )}
          >
            {enabled ? '🔔' : '🔕'}
          </motion.span>
        </span>
      </button>

      <AnimatePresence>
        {message && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className="mt-2 rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100"
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Explains the iOS install case, which is the most common "it does not
          work" report for a PWA notification toggle. */}
      {enabled && permission === 'denied' && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-white/35">
          <Smartphone className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          <span>{t('notify.iosHint')}</span>
        </p>
      )}
    </div>
  );
}