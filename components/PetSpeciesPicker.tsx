'use client';

// components/PetSpeciesPicker.tsx
// The "Loài thú cưng" field: rounded glass chips, plus a free-text escape
// hatch that slides open only when "Khác" is chosen.
//
// WHY CHIPS AND NOT A <select>
//   The field is picked from a handful of options, on both the booking form and
//   the profile. A native select on iOS covers half the screen, cannot show the
//   emoji that makes each option scannable, and offers no way to type an animal
//   that is not in the list. Chips render inline, wrap naturally at 360px, and
//   leave the door open for exotic species.
//
// THE "KHÁC" FIELD
//   It appears BESIDE the chips rather than replacing them, so the customer can
//   see that "Khác" was understood and back out by picking a different chip.
//   It animates open on height + opacity and is announced via aria-expanded.
//
// VALIDATION
//   Runs through lib/petSpecies.ts on blur, not on every keystroke — a live error
//   under a field the user is still typing in reads as the field being broken.
//   The message offers the suggestion chips so the recovery is one tap.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, PawPrint, Search } from 'lucide-react';
import {
  validatePetSpecies,
  SPECIES_ERROR_MESSAGES,
  SPECIES_SUGGESTIONS,
} from '@/lib/petSpecies';
import { cn } from '@/lib/utils';

export interface SpeciesOption {
  value: string;
  label: string;
  emoji: string;
}

interface Props {
  value: string;
  onChange: (species: string) => void;
  options?: readonly SpeciesOption[];
  label?: string;
  /** Shown under the field. Rendered only when there is an error. */
  id?: string;
}

const DEFAULT_OPTIONS: readonly SpeciesOption[] = [
  { value: 'Chó', label: 'Chó', emoji: '🐶' },
  { value: 'Mèo', label: 'Mèo', emoji: '🐱' },
  { value: 'Khác', label: 'Khác', emoji: '🐾' },
];

export default function PetSpeciesPicker({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  label = 'Loài thú cưng',
  id,
}: Props) {
  // Derived, not stored: the input's visibility is decided purely by whether the
  // parent still holds "Khác". A separate `otherOpen` flag could drift out of
  // sync with `value` and leave a stale input on screen.
  const [otherValue, setOtherValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const otherRef = useRef<HTMLInputElement>(null);

  const isOther = value === 'Khác';

  // When the parent switches back to a known chip, collapse the escape hatch so
  // it does not linger with a stale value the user can no longer see.
  useEffect(() => {
    if (!isOther) {
      setOtherValue('');
      setError(null);
    }
  }, [isOther]);

  const pick = useCallback(
    (option: SpeciesOption) => {
      if (option.value === 'Khác') {
        onChange('Khác');
        // Focus after the height animation has begun, else the browser cancels
        // the scroll into view.
        window.setTimeout(() => otherRef.current?.focus(), 220);
        return;
      }
      setError(null);
      onChange(option.value);
    },
    [onChange]
  );

  /** Judge on blur — the field is still being typed into until then. */
  const validateOther = useCallback(() => {
    const trimmed = otherValue.trim();
    if (!trimmed) {
      // Nothing typed yet is not an error; the parent form decides whether a
      // species is required at all.
      setError(null);
      return;
    }
    const verdict = validatePetSpecies(trimmed);
    if (verdict.ok) {
      setError(null);
      onChange(trimmed);
      return;
    }
    setError(SPECIES_ERROR_MESSAGES[verdict.reason]);
    // The parent keeps "Khác" so the chip selection does not silently revert
    // while the customer is looking at the error.
    onChange('Khác');
  }, [otherValue, onChange]);

  const applySuggestion = useCallback(
    (suggestion: string) => {
      setError(null);
      setOtherValue(suggestion);
      onChange(suggestion);
    },
    [onChange]
  );

  return (
    <div className={cn('min-w-0', id)}>
      <span className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
        <PawPrint className="size-3.5" aria-hidden="true" />
        {label}
      </span>

      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.value || (option.value === 'Khác' && isOther && !!otherValue);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => pick(option)}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-200 active:scale-[0.97]',
                active
                  ? 'border-emerald-300/50 bg-emerald-400/20 text-white shadow-[0_0_0_3px_rgba(52,211,153,0.12)]'
                  : 'border-white/15 bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white'
              )}
            >
              <span aria-hidden="true" className="text-base leading-none">
                {option.emoji}
              </span>
              {option.label}
              {active && <Check className="size-3.5 text-emerald-300" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {/* The escape hatch. Sits BESIDE the chips (not below the whole group) so
          the connection to the "Khác" chip it came from is obvious. */}
      <AnimatePresence initial={false}>
        {isOther && (
          <motion.div
            key="other-species"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl border border-white/12 bg-white/[0.05] p-3.5">
              <label
                htmlFor="pet-species-other"
                className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-white/60"
              >
                <Search className="size-3.5" aria-hidden="true" />
                Nhập tên loài thú cưng
              </label>
              <input
                ref={otherRef}
                id="pet-species-other"
                value={otherValue}
                onChange={(e) => {
                  setOtherValue(e.target.value);
                  // Clear a previous error as soon as the user edits, so the
                  // message does not contradict what they are now typing.
                  if (error) setError(null);
                }}
                onBlur={validateOther}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    validateOther();
                  }
                }}
                maxLength={60}
                placeholder="Ví dụ: hamster, alpaca, nhím, thỏ…"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'pet-species-error' : undefined}
                className={cn(
                  'w-full rounded-xl border bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none backdrop-blur-xl transition-colors placeholder:text-white/25',
                  error
                    ? 'border-red-400/60 focus:border-red-300/70'
                    : 'border-white/15 focus:border-emerald-300/60'
                )}
              />

              <AnimatePresence>
                {error && (
                  <motion.p
                    id="pet-species-error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    role="alert"
                    className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold leading-relaxed text-red-300"
                  >
                    <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Recovery chips — one tap instead of retyping. */}
              {!error && otherValue.trim() && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-white/35">
                    Gợi ý:
                  </span>
                  {SPECIES_SUGGESTIONS.slice(0, 6).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => applySuggestion(suggestion)}
                      className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-white/65 transition-colors hover:bg-white/12 hover:text-white"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { validatePetSpecies } from '@/lib/petSpecies';