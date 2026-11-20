'use client';

// components/PetThemeToggle.tsx
// The "Pet Theme Toggle" — the light/dark switch.
//
// SHAPE
//   A real <label> wrapping a visually-hidden checkbox plus a 100×50 slider, so
//   the whole control is one native, keyboard-operable toggle. The chip inside
//   the slider carries 🐾 and travels with an overshooting spring
//   (cubic-bezier(0.68,-0.55,0.265,1.55)) — the overshoot is the point: it makes
//   the switch feel physical rather than mechanical.
//
// WHY A CHECKBOX AND NOT A BUTTON
//   A button needs role="switch", aria-checked, keydown handling and focus
//   management to be accessible. A checkbox inside a label gives all of that for
//   free, including Space-to-toggle, and it degrades correctly if the JS that
//   wires it up never runs.
//
// SCOPE
//   Toggled via data-theme on <html>, which the CSS tokens in globals.css read.
//   The navbar and footer are pinned to their own appearance (see
//   components/ThemeProvider.tsx for why).

import { useTheme } from '@/components/ThemeProvider';

interface PetThemeToggleProps {
  className?: string;
  /** Which label the screen reader announces for the "on" state. */
  onLabel?: string;
  offLabel?: string;
}

export default function PetThemeToggle({
  className = '',
  onLabel = 'Chế độ tối',
  offLabel = 'Chế độ sáng',
}: PetThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <label className={`pet-theme-toggle ${className}`}>
      {/*
        Visually hidden but NOT display:none and NOT aria-hidden — a
        display:none input is removed from the accessibility tree, and
        aria-hidden on the focusable control breaks the label association, so
        keyboard users would have no way to reach it.
      */}
      <input
        type="checkbox"
        className="peer sr-only"
        checked={isDark}
        onChange={toggleTheme}
        aria-label={isDark ? onLabel : offLabel}
      />

      <span className="pet-theme-toggle__track" aria-hidden="true">
        <span className="pet-theme-toggle__bone">🦴</span>
        <span className="pet-theme-toggle__fish">🐟</span>
        <span className="pet-theme-toggle__chip">🐾</span>
      </span>
    </label>
  );
}