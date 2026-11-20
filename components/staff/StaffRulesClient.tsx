'use client';

// components/staff/StaffRulesClient.tsx
// /staff/rules — the code of conduct, as an accordion.
//
// WHY THE SEARCH BOX MATTERS HERE
//   Eight sections, 40-odd rules. Somebody looking for "what do I do if the pet
//   escapes" should not have to scroll and expand four panels to find it. The
//   search matches section titles AND individual rule lines, and expands every
//   section that has a hit — so a search never leaves the answer hidden inside a
//   collapsed panel.
//
// THE ACKNOWLEDGEMENT
//   One button at the bottom, and it records the VERSION (see lib/staffRules.ts).
//   Until pressed, a persistent amber banner sits under the header so the state
//   is never ambiguous.

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  STAFF_RULES,
  RULES_LAST_UPDATED,
  type StaffRuleSection,
} from '@/lib/staffRules';
import { cn } from '@/lib/utils';

/**
 * Diacritic- and case-insensitive, so "an toan" finds "An toàn" and
 * "bao mat" finds "Bảo mật".
 *
 * The combining-mark range is written with explicit escapes rather than a
 * literal `[̀-ͯ]`, because the literal is invisible in an editor and easy to
 * mangle in a copy-paste — a mangled range silently stops stripping diacritics
 * and the search appears broken for exactly the accented text it targets.
 */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '').replace(/đ/g, 'd').trim();
}

interface RulesPayload {
  sections: StaffRuleSection[];
  version: number;
  lastUpdated: string;
  itemCount: number;
  acknowledgedAt: string | null;
}

export default function StaffRulesClient({ version }: { version: number }) {
  const [sections, setSections] = useState<StaffRuleSection[]>(() => [...STAFF_RULES]);
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string[]>([STAFF_RULES[0].id]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/staff/rules', { cache: 'no-store' });
        const data = (await res.json()) as RulesPayload & { error?: string };
        if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
        if (cancelled) return;
        setSections(data.sections);
        setAcknowledgedAt(data.acknowledgedAt);
      } catch (e) {
        if (!cancelled) {
          // The bundled copy still renders — an unreachable API must not hide the
          // rules from the employee who needs to read them right now.
          setError(
            e instanceof Error
              ? `${e.message}. Đang hiển thị bản nội quy có sẵn trong ứng dụng.`
              : 'Không tải được nội quy từ máy chủ.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const needle = normalize(query);

  /**
   * Filter at the SECTION level but keep every rule inside a matching section,
   * so searching "găng" shows the whole "An toàn sinh học" panel rather than one
   * orphan line with its context removed.
   */
  const filtered = useMemo(() => {
    if (!needle) return sections;
    return sections
      .map((section) => {
        const titleHit = normalize(`${section.title} ${section.summary}`).includes(needle);
        const hits = section.items.filter((item) => normalize(item).includes(needle));
        if (!titleHit && hits.length === 0) return null;
        return { ...section, items: titleHit ? section.items : hits };
      })
      .filter((section): section is StaffRuleSection => section !== null);
  }, [sections, needle]);

  // A search always expands its results — an answer inside a collapsed panel is
  // an answer nobody reads.
  useEffect(() => {
    if (!needle) return;
    setOpen(filtered.map((section) => section.id));
  }, [needle, filtered]);

  function toggle(id: string) {
    setOpen((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  async function acknowledge() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/staff/rules', { method: 'POST' });
      const data = (await res.json()) as { acknowledgedAt?: string; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Không ghi nhận được.');
      setAcknowledgedAt(data.acknowledgedAt ?? new Date().toISOString());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Không ghi nhận được. Vui lòng thử lại hoặc báo quản lý.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const totalShown = filtered.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-[#070b16] via-[#0b1322] to-[#0d1526] px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-liquid-mesh" />

      <div className="relative mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-400/10 px-3.5 py-1 text-xs font-semibold text-amber-300">
            <ShieldCheck className="size-3.5" />
            Belwee Pet Clinic · phiên bản {version}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold text-white">Nội quy tuân thủ</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-white/50">
            Cập nhật lần cuối {RULES_LAST_UPDATED} · {sections.length} mục ·{' '}
            {sections.reduce((sum, s) => sum + s.items.length, 0)} quy định
          </p>
        </div>

        {/* Acknowledgement state */}
        <AnimatePresence mode="wait" initial={false}>
          {acknowledgedAt ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3.5"
            >
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-emerald-200">
                  Bạn đã cam kết tuân thủ nội quy phiên bản {version}
                </p>
                <p className="mt-0.5 text-xs text-emerald-200/70">
                  Thời điểm xác nhận:{' '}
                  {new Date(acknowledgedAt).toLocaleString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3.5"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden="true" />
              <p className="text-sm text-amber-100">
                Bạn chưa xác nhận nội quy phiên bản {version}. Vui lòng đọc và bấm xác nhận ở
                cuối trang.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p
            role="alert"
            className="mb-5 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200"
          >
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Đóng" className="ml-auto">
              <X className="size-3.5" />
            </button>
          </p>
        )}

        {/* Search */}
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm trong nội quy — ví dụ: găng, bảo mật, huỷ lịch, chấm công…"
            aria-label="Tìm trong nội quy"
            className="w-full rounded-full border border-white/15 bg-white/10 py-3 pl-11 pr-11 text-sm text-white outline-none backdrop-blur-2xl transition-all placeholder:text-white/35 focus:border-amber-300/40 focus:shadow-[0_0_0_4px_rgba(251,191,36,0.12)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Xoá tìm kiếm"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {needle && (
          <p className="mb-4 text-xs text-white/45" role="status">
            {filtered.length === 0
              ? 'Không tìm thấy quy định nào phù hợp.'
              : `Tìm thấy ${totalShown} quy định trong ${filtered.length} mục.`}
          </p>
        )}

        {/* Accordion */}
        <div className="space-y-3">
          {filtered.map((section) => {
            const isOpen = open.includes(section.id);
            return (
              <div
                key={section.id}
                className="overflow-hidden rounded-[24px] border border-white/12 bg-white/[0.06] backdrop-blur-2xl"
              >
                <button
                  type="button"
                  onClick={() => toggle(section.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06] text-xl"
                  >
                    {section.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold text-white">{section.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-white/45">
                      {section.summary}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full border border-white/12 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-white/50">
                      {section.items.length}
                    </span>
                    <ChevronDown
                      className={cn(
                        'size-4 text-white/50 transition-transform duration-300',
                        isOpen && 'rotate-180'
                      )}
                    />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <ul className="space-y-2.5 border-t border-white/8 px-5 py-4">
                        {section.items.map((item, index) => {
                          // Mark the matched phrase so the user can see WHY a
                          // line matched rather than just trusting the filter.
                          const at = needle
                            ? normalize(item).indexOf(needle)
                            : -1;
                          return (
                            <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-white/80">
                              <span
                                aria-hidden="true"
                                className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/10 text-[9px] font-bold text-emerald-300"
                              >
                                {index + 1}
                              </span>
                              <span>
                                {at !== -1 ? (
                                  <>
                                    {item.slice(0, at)}
                                    <mark className="rounded bg-amber-300/25 px-0.5 text-amber-100">
                                      {item.slice(at, at + needle.length)}
                                    </mark>
                                    {item.slice(at + needle.length)}
                                  </>
                                ) : (
                                  item
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Acknowledgement button */}
        <div className="mt-8 rounded-[28px] border border-white/12 bg-white/[0.06] p-6 text-center backdrop-blur-2xl">
          <p className="text-sm leading-relaxed text-white/75">
            Bấm nút bên dưới để xác nhận bạn đã đọc và cam kết tuân thủ toàn bộ nội quy
            phiên bản {version}.
          </p>
          <p className="mt-1 text-xs text-white/40">
            Thời điểm xác nhận sẽ được lưu vào hồ sơ của bạn.
          </p>

          <button
            type="button"
            onClick={() => void acknowledge()}
            disabled={submitting || acknowledgedAt !== null}
            className={cn(
              'mt-5 inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-extrabold transition-all active:scale-[0.98]',
              acknowledgedAt
                ? 'cursor-default border border-emerald-300/25 bg-emerald-400/10 text-emerald-200'
                : 'bg-gradient-to-r from-emerald-400 to-teal-300 text-slate-950 shadow-liquid-glow-emerald hover:brightness-110 disabled:opacity-60'
            )}
          >
            {submitting ? (
              <Loader2 className="size-4.5 animate-spin" />
            ) : acknowledgedAt ? (
              <BadgeCheck className="size-4.5" />
            ) : (
              <CheckCircle2 className="size-4.5" />
            )}
            {submitting
              ? 'Đang ghi nhận…'
              : acknowledgedAt
                ? 'Đã xác nhận tuân thủ'
                : 'Tôi đã đọc và cam kết tuân thủ'}
          </button>
        </div>

        {loading && (
          <p className="mt-4 text-center text-xs text-white/35" role="status">
            Đang đồng bộ phiên bản mới nhất…
          </p>
        )}
      </div>
    </div>
  );
}