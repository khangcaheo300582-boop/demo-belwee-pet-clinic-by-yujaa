"use client";

// components/portal/BookingStatusTimeline.tsx
// Dòng tiến trình lịch hẹn cho khách hàng.
//
// ── VÌ SAO TRẠNG THÁI KHÔNG CHỈ ĐƯỢC NÓI BẰNG MÀU ───────────────────────
//   done / current / upcoming / skipped phân biệt bằng màu và độ đậm. Người đọc
//   khiếm thị sẽ không thấy khác biệt đó — WCAG 1.4.1 (Dùng màu) nêu rõ màu
//   không được là thông tin duy nhất. Vì vậy mỗi bước có một đoạn `sr-only`
//   đọc trạng thái bằng lời, và dấu `aria-current="step"` cho bước đang diễn ra.
//
// ── VÌ SAO HIỆN "Chưa ghi nhận thời gian" ─────────────────────────────────
//   Bước Hoàn thành / Đã huỷ không có mốc thời gian trong mô hình dữ liệu (xem
//   lib/bookingTimeline.ts). Giấu luôn cả dòng thời gian sẽ khiến người đọc
//   tưởng dữ liệu bị mất. Nói thẳng "chưa ghi nhận" thì trung thực và không tốn
//   nhiều chỗ.

import { Check, CircleDashed, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/LanguageProvider';
import type { TimelineState, TimelineStep } from '@/lib/bookingTimeline';
import type { Language, MessageKey } from '@/lib/i18n';

/** Định dạng giờ theo ngôn ngữ đang chọn — trang này chưa dịch, timeline thì có. */
const LOCALE: Record<Language, string> = { vi: 'vi-VN', en: 'en-GB' };

function formatWhen(iso: string, lang: Language) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(LOCALE[lang], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * `translate()` không nội suy tham số, nên placeholder `{pet}` / `{service}`
 * được thay tay ở đây. Chỉ thay những khoá thực sự có mặt trong câu — thay
 * trong chuỗi đã dịch sẽ không gây hại, nhưng lặp vô nghĩa thì có.
 */
function interpolate(text: string, values?: Record<string, string>) {
  if (!values) return text;
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, value),
    text
  );
}

const DOT_STYLE: Record<TimelineState, { ring: string; icon: typeof Check }> = {
  done: { ring: 'border-emerald-300/60 bg-emerald-400/20 text-emerald-200', icon: Check },
  current: { ring: 'border-sky-300/70 bg-sky-400/20 text-sky-100', icon: CircleDashed },
  upcoming: { ring: 'border-white/25 bg-white/5 text-white/55', icon: CircleDashed },
  skipped: { ring: 'border-rose-300/40 bg-rose-400/10 text-rose-200', icon: Minus },
};

/** Nhãn trạng thái đọc bằng lỗi cho trình đọc màn hình. */
const STATE_LABEL: Record<TimelineState, MessageKey> = {
  done: 'timeline.legendDone',
  current: 'timeline.legendCurrent',
  upcoming: 'timeline.legendUpcoming',
  skipped: 'timeline.legendSkipped',
};

export default function BookingStatusTimeline({ steps }: { steps: TimelineStep[] }) {
  const { t, lang } = useLanguage();

  if (steps.length === 0) return null;

  return (
    <ol className="relative space-y-4 pl-1">
      {/*
        Đường nối dọc chạy giữa các chấm tròn. Vẽ bằng pseudo-element trên `ol`
        thay vì thêm một node: node thừa trong `<ol>` sẽ bị trình đọc màn hình
        đọc như một mục danh sách, tức là thông tin sai.
      */}
      <span aria-hidden className="absolute bottom-3 left-[11px] top-3 w-px bg-white/15" />

      {steps.map(step => {
        const style = DOT_STYLE[step.state];
        const Icon = style.icon;
        const when = step.atISO ? formatWhen(step.atISO, lang) : null;
        const label = interpolate(t(step.labelKey), step.values);

        return (
          <li key={step.key} className="relative flex items-start gap-3">
            <span
              aria-hidden
              className={cn(
                'relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border',
                style.ring,
                step.state === 'skipped' && 'opacity-70'
              )}
            >
              <Icon className={cn('size-3.5', step.state === 'current' && 'animate-spin [animation-duration:4s]')} />
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm font-semibold',
                  // Trạng thái bị bỏ qua thì mờ đi — nhưng KHÔNG mờ đến mức mất
                  // chữ, vì khách vẫn cần đọc "đã huỷ" là chuyện gì đã xảy ra.
                  step.state === 'skipped' ? 'text-white/60' : 'text-white'
                )}
                aria-current={step.state === 'current' ? 'step' : undefined}
              >
                {label}
                {/* Trạng thái bằng lời, không dựa vào màu. */}
                <span className="sr-only"> — {t(STATE_LABEL[step.state])}</span>
              </p>

              {step.detailKey && (
                <p className="mt-0.5 text-xs text-white/60">{interpolate(t(step.detailKey), step.values)}</p>
              )}

              {step.byName && (
                <p className="mt-0.5 text-xs text-white/60">
                  {t('timeline.staff')}: <span className="font-semibold text-white/85">{step.byName}</span>
                </p>
              )}

              <p className="mt-0.5 text-xs text-white/60">
                {when ?? <span className="italic">{t('timeline.noTime')}</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
