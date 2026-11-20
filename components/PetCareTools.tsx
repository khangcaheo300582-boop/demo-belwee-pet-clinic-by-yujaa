'use client';

// components/PetCareTools.tsx
// Ba công cụ cho khách: quy đổi tuổi, khẩu phần, kiểm tra triệu chứng.
//
// ── VÌ SAO TÁCH RIÊNG FILE ────────────────────────────────────────────────────
// Toán học nằm ở lib/petCareTools.ts (thuần, không React, không chuỗi hiển thị).
// File này chỉ lo dựng giao diện + dịch. Nhờ vậy đổi công thức không đụng tới
// layout, và test được phần toán mà không cần mount component.
//
// ── VÌ SAO KHÔNG CÓ CHỮ "CHẨN ĐOÁN" ─────────────────────────────────────────
// Đây là công cụ tự chẩn loại (self-check), nguy cơ lớn nhất là người dùng đọc
// "theo dõi tại nhà" rồi chủ quan trì hoãn. Vì vậy:
//   1. Mọi kết quả đều kèm cảnh báo đưa thú cưng đến bác sĩ — không phải ở
//      chân trang mà ngay dưới con số vừa tính.
//   2. Trạng thái `urgent` đổi màu + kèm số hotline, không chỉ đổi câu chữ.
//   3. `role="status"` để trình đọc màn hình đọc ra mức độ khi nó thay đổi.
//
// ── VỀ NHỊP CẬP NHẬT ──────────────────────────────────────────────────────────
// Hai slider đầu dùng `onInput` + `requestAnimationFrame` để con số đuổi kịp
// ngón tay mà không setState 60 lần/giây. Danh sách triệu chứng thì chấm lại
// ngay — chỉ 17 mục, chi phí không đáng kể.

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Bone,
  Cat,
  CheckCircle2,
  Dog,
  Info,
  PhoneCall,
  Scale,
  Stethoscope,
} from 'lucide-react';
import {
  ALL_SYMPTOM_IDS,
  SYMPTOM_GROUPS,
  dailyPortion,
  humanAgeParts,
  isCriticalSymptom,
  triageScore,
  type PetKind,
  type SymptomId,
} from '@/lib/petCareTools';
import type { MessageKey } from '@/lib/i18n';
import { HOTLINE, HOTLINE_DISPLAY } from '@/lib/clinics';
import { useLanguage } from '@/components/LanguageProvider';
import { cn } from '@/lib/utils';

/** Tuổi tối đa hiển thị — thú cưng trên 30 tuổi là hiện tượng cực hiếm. */
const MAX_PET_YEARS = 30;
/** Cân nặng hợp lý để slider không chạy về 0 và chia 0 khi kéo hết cỡ. */
const MIN_WEIGHT_KG = 0.5;
const MAX_WEIGHT_KG = 90;
const MAX_AGE_MONTHS = 240;

/** Vạch kẻ của slider — dùng CSS gradient nên không phụ thuộc thư viện. */
function rangeBackground(value: number, min: number, max: number): string {
  const ratio = max === min ? 0 : (value - min) / (max - min);
  return `linear-gradient(90deg, var(--pt-accent) ${ratio * 100}%, rgb(var(--pt-border-rgb) / 0.22) ${ratio * 100}%)`;
}

const RANGE_CLASS =
  'h-2.5 w-full cursor-pointer appearance-none rounded-full outline-none ' +
  '[&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none ' +
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 ' +
  '[&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--pt-accent)] ' +
  '[&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.35)] ' +
  '[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:appearance-none ' +
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 ' +
  '[&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--pt-accent)]';

interface Props {
  /** Đường dẫn đặt lịch — trang cha chỉ cần truyền khi muốn có CTA. */
  bookHref?: string;
}

export default function PetCareTools({ bookHref = '/booking/kham-benh' }: Props) {
  const { t } = useLanguage();

  /* ── 1. Quy đổi tuổi ────────────────────────────────────────────────────── */
  const [ageKind, setAgeKind] = useState<PetKind>('dog');
  const [petAgeYears, setPetAgeYears] = useState(3);

  const ageParts = useMemo(
    () => humanAgeParts(ageKind, petAgeYears),
    [ageKind, petAgeYears]
  );

  /* ── 2. Khẩu phần ───────────────────────────────────────────────────────── */
  const [foodKind, setFoodKind] = useState<PetKind>('dog');
  const [weightKg, setWeightKg] = useState(12);
  const [ageMonths, setAgeMonths] = useState(36);
  const [overweight, setOverweight] = useState(false);

  const portion = useMemo(
    () => dailyPortion(foodKind, weightKg, ageMonths, overweight),
    [foodKind, weightKg, ageMonths, overweight]
  );

  /* ── 3. Kiểm tra triệu chứng ────────────────────────────────────────────── */
  const [checked, setChecked] = useState<string[]>([]);
  const triage = useMemo(() => triageScore(checked), [checked]);

  /** Các mã nguy hiểm đang được tick — dùng cho dòng tóm tắt kết quả. */
  const criticalChecked = useMemo(
    () =>
      checked.filter((id) => isCriticalSymptom(id as SymptomId)) as SymptomId[],
    [checked]
  );

  const toggleSymptom = useCallback((id: SymptomId) => {
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const clearSymptoms = useCallback(() => setChecked([]), []);

  /**
   * Nhãn nhóm nguy hiểm cho phần tóm tắt kết quả — tra i18n theo mã.
   *
   * Ép `MessageKey` ở đây là an toàn chứ không phải lách: `SymptomId` được
   * sinh từ chính khoá `tools.symptoms.*` của lib/i18n.ts, nên template literal
   * này luôn hợp lệ. Nếu không ép, TS không tự suy ra kiểu template literal.
   */
  const symptomLabel = useCallback(
    (id: SymptomId) => t(`tools.symptoms.${id}` as MessageKey),
    [t]
  );

  /**
   * Đồng bộ hai công cụ đầu khi đổi loài: nếu không, người dùng chọn "Mèo" ở
   * ô tuổi rồi xem "Khẩu phần" lại đang tính cho chó mà không có dấu hiệu nào
   * cho biết — công cụ sai âm thầm còn tệ hơn không có công cụ.
   */
  const pickAgeKind = useCallback(
    (kind: PetKind) => {
      setAgeKind(kind);
      setFoodKind(kind);
    },
    []
  );
  const pickFoodKind = useCallback(
    (kind: PetKind) => {
      setFoodKind(kind);
      setAgeKind(kind);
    },
    []
  );

  /* Số "tháng" còn lại của tuổi thú cưng, làm tròn về gần nhất cho slider. */
  const monthsPart = Math.round((petAgeYears % 1) * 12);

  const severityMeta = {
    watch: {
      label: t('tools.checkSeverityWatch'),
      icon: CheckCircle2,
      ring: 'border-emerald-400/45 bg-emerald-500/12',
      text: 'text-[var(--pt-ok)]',
      bar: 'bg-[var(--pt-ok)]',
    },
    soon: {
      label: t('tools.checkSeveritySoon'),
      icon: Stethoscope,
      ring: 'border-amber-400/45 bg-amber-500/12',
      text: 'text-amber-600 dark:text-amber-300',
      bar: 'bg-amber-500',
    },
    urgent: {
      label: t('tools.checkSeverityUrgent'),
      icon: AlertTriangle,
      ring: 'border-red-500/50 bg-red-500/14',
      text: 'text-[var(--pt-danger)]',
      bar: 'bg-[var(--pt-danger)]',
    },
  }[triage.severity];

  const SeverityIcon = severityMeta.icon;

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* ══ 1. Quy đổi tuổi ═══════════════════════════════════════════════ */}
      <section className="pt-glass pt-glass-strong pt-focus mb-6 p-5 sm:p-7" aria-labelledby="tool-age">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="tool-age"
              className="pt-heading flex items-center gap-2 text-lg font-bold sm:text-xl"
            >
              <Bone className="size-5 shrink-0 text-[var(--pt-accent)]" aria-hidden="true" />
              {t('tools.ageTitle')}
            </h2>
            <p className="pt-muted mt-1.5 text-sm leading-relaxed">{t('tools.ageDesc')}</p>
          </div>
          <KindToggle
            value={ageKind}
            onChange={pickAgeKind}
            labels={{ dog: t('tools.ageDog'), cat: t('tools.ageCat') }}
          />
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-center">
          <div className="min-w-0">
            <label
              htmlFor="tool-age-years"
              className="pt-heading mb-2 flex items-baseline justify-between text-sm font-semibold"
            >
              <span>{t('tools.agePetLabel')}</span>
              <span className="pt-muted font-normal tabular-nums">
                {petAgeYears} {t('tools.ageYears')}
                {monthsPart > 0 ? ` · ${monthsPart} ${t('tools.ageMonths')}` : ''}
              </span>
            </label>
            <input
              id="tool-age-years"
              type="range"
              min={0}
              max={MAX_PET_YEARS}
              step={0.25}
              value={petAgeYears}
              onChange={(event) => setPetAgeYears(Number(event.target.value))}
              style={{ background: rangeBackground(petAgeYears, 0, MAX_PET_YEARS) }}
              className={RANGE_CLASS}
            />

            {/* Nút bước nhanh — kéo slider từ 0 lên 15 tuổi mất ~15 lần bấm. */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[0.5, 1, 3, 5, 8, 12].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPetAgeYears(preset)}
                  aria-pressed={petAgeYears === preset}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition-colors',
                    petAgeYears === preset
                      ? 'border-transparent bg-[var(--pt-accent)] text-[var(--pt-on-accent)]'
                      : 'border-[rgb(var(--pt-border-rgb)/0.22)] hover:bg-[var(--pt-accent-soft)]'
                  )}
                >
                  {preset < 1 ? '6 th' : `${preset} ${t('tools.ageYears')}`}
                </button>
              ))}
            </div>
          </div>

          {/* Kết quả. aria-live vì đổi loài cũng làm con số đổi, không chỉ kéo. */}
          <motion.div
            key={`${ageKind}-${ageParts.years}-${ageParts.months}`}
            initial={{ opacity: 0.4, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            aria-live="polite"
            className="rounded-2xl border border-[rgb(var(--pt-border-rgb)/0.16)] bg-[var(--pt-accent-soft)] px-5 py-4 text-center"
          >
            <p className="pt-muted text-xs leading-relaxed">{t('tools.ageResult')}</p>
            <p className="pt-heading mt-1 text-4xl font-bold tabular-nums sm:text-5xl">
              {/* Thứ tự "năm rồi tháng" là bắt buộc: tiếng Việt và tiếng Anh
                  đều viết tuổi theo thứ tự này ("2 năm 3 tháng" / "2 years 3
                  months"). Đảo lại sẽ ra "3 tháng 2 năm". */}
              {ageParts.years}
              <span className="ml-1.5 text-lg font-semibold">{t('tools.ageYears')}</span>
              {ageParts.months > 0 && (
                <>
                  <span className="ml-1.5 text-lg font-semibold">{ageParts.months}</span>
                  <span className="ml-1 text-lg font-semibold">{t('tools.ageMonths')}</span>
                </>
              )}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ══ 2. Khẩu phần ══════════════════════════════════════════════════ */}
      <section
        className="pt-glass pt-glass-strong pt-focus mb-6 p-5 sm:p-7"
        aria-labelledby="tool-food"
      >
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="tool-food"
              className="pt-heading flex items-center gap-2 text-lg font-bold sm:text-xl"
            >
              <Scale className="size-5 shrink-0 text-[var(--pt-accent)]" aria-hidden="true" />
              {t('tools.foodTitle')}
            </h2>
            <p className="pt-muted mt-1.5 text-sm leading-relaxed">{t('tools.foodDesc')}</p>
          </div>
          <KindToggle
            value={foodKind}
            onChange={pickFoodKind}
            labels={{ dog: t('tools.ageDog'), cat: t('tools.ageCat') }}
          />
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-center">
          <div className="min-w-0 space-y-5">
            <div>
              <label
                htmlFor="tool-weight"
                className="pt-heading mb-2 flex items-baseline justify-between text-sm font-semibold"
              >
                <span>{t('tools.foodWeight')}</span>
                <span className="pt-muted font-normal tabular-nums">{weightKg} kg</span>
              </label>
              <input
                id="tool-weight"
                type="range"
                min={MIN_WEIGHT_KG}
                max={MAX_WEIGHT_KG}
                step={0.5}
                value={weightKg}
                onChange={(event) => setWeightKg(Number(event.target.value))}
                style={{ background: rangeBackground(weightKg, MIN_WEIGHT_KG, MAX_WEIGHT_KG) }}
                className={RANGE_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="tool-age-months"
                className="pt-heading mb-2 flex items-baseline justify-between text-sm font-semibold"
              >
                <span>{t('tools.foodAge')}</span>
                <span className="pt-muted font-normal tabular-nums">
                  {ageMonths} {t('tools.ageMonths')}
                </span>
              </label>
              <input
                id="tool-age-months"
                type="range"
                min={1}
                max={MAX_AGE_MONTHS}
                step={1}
                value={ageMonths}
                onChange={(event) => setAgeMonths(Number(event.target.value))}
                style={{ background: rangeBackground(ageMonths, 1, MAX_AGE_MONTHS) }}
                className={RANGE_CLASS}
              />
            </div>

            <label className="pt-glass flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={overweight}
                onChange={(event) => setOverweight(event.target.checked)}
                className="size-4 shrink-0 accent-[var(--pt-accent)]"
              />
              {t('tools.foodOverweight')}
            </label>
          </div>

          <motion.div
            key={`${foodKind}-${portion.gramsPerDay}-${portion.meals}`}
            initial={{ opacity: 0.4, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            aria-live="polite"
            className="rounded-2xl border border-[rgb(var(--pt-border-rgb)/0.16)] bg-[var(--pt-accent-soft)] px-5 py-4 text-center"
          >
            <p className="pt-muted text-xs leading-relaxed">{t('tools.foodResult')}</p>
            <p className="pt-heading mt-1 text-4xl font-bold tabular-nums sm:text-5xl">
              {portion.gramsPerDay}
              <span className="ml-1.5 text-lg font-semibold">{t('tools.foodPerDay')}</span>
            </p>
            <p className="pt-muted mt-1.5 text-sm tabular-nums">
              {t('tools.foodPerMeal')}: {portion.gramsPerMeal} g · {portion.meals}{' '}
              {t('tools.foodMeals')}
            </p>
            <p className="pt-muted mt-3 border-t border-[rgb(var(--pt-border-rgb)/0.14)] pt-3 text-xs leading-relaxed">
              {foodKind === 'dog' ? t('tools.foodNoteDog') : t('tools.foodNoteCat')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ══ 3. Kiểm tra triệu chứng ════════════════════════════════════════ */}
      <section className="pt-glass pt-glass-strong pt-focus p-5 sm:p-7" aria-labelledby="tool-check">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="tool-check"
              className="pt-heading flex items-center gap-2 text-lg font-bold sm:text-xl"
            >
              <Stethoscope
                className="size-5 shrink-0 text-[var(--pt-accent)]"
                aria-hidden="true"
              />
              {t('tools.checkTitle')}
            </h2>
            <p className="pt-muted mt-1.5 text-sm leading-relaxed">{t('tools.checkDesc')}</p>
          </div>
          <button
            type="button"
            onClick={clearSymptoms}
            disabled={checked.length === 0}
            className="pt-focus rounded-full border border-[rgb(var(--pt-border-rgb)/0.22)] px-4 py-2 text-xs font-semibold transition-colors hover:bg-[var(--pt-accent-soft)] disabled:opacity-40"
          >
            {t('tools.checkReset')}
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* Danh sách triệu chứng, tách làm hai khối: NGUY HIỂM và NHẸ.
              Đây là khác biệt quan trọng nhất về mặt sử dụng: trước đó 17 ô nằm
              chung một lưới trông như danh sách "mọi thứ đều khẩn cấp", người
              dùng không biết ô nào bắt buộc phải tick và ô nào tuỳ. Giờ nhóm
              nguy hiểm đứng trên, có viền đỏ và câu "một mã là đủ"; nhóm nhẹ có
              nền trung tính và câu "một hoặc hai thì theo dõi tại nhà". */}
          <div className="min-w-0 space-y-7">
            {SYMPTOM_GROUPS.map((group) => (
              <fieldset
                key={group.id}
                className={cn(
                  'rounded-2xl border p-4 transition-colors',
                  group.critical
                    ? 'border-[var(--pt-danger)]/35 bg-[rgb(var(--pt-danger)/0.06)]'
                    : 'border-[rgb(var(--pt-border-rgb)/0.16)]'
                )}
              >
                <legend
                  className={cn(
                    'px-1 text-xs font-bold uppercase tracking-[0.14em]',
                    group.critical ? 'text-[var(--pt-danger)]' : 'pt-muted'
                  )}
                >
                  {group.critical ? t('tools.groupCriticalTitle') : t('tools.groupMildTitle')}
                </legend>
                <p className="mb-3 px-1 text-xs leading-relaxed">
                  {group.critical ? t('tools.groupCriticalDesc') : t('tools.groupMildDesc')}
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  {group.symptoms.map((id) => {
                    const active = checked.includes(id);
                    return (
                      <label
                        key={id}
                        className={cn(
                          'pt-focus flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-snug transition-colors',
                          active
                            ? cn(
                                'border-transparent font-semibold',
                                group.critical
                                  ? 'bg-[rgb(var(--pt-danger)/0.14)]'
                                  : 'bg-[var(--pt-accent-soft)]'
                              )
                            : 'border-[rgb(var(--pt-border-rgb)/0.16)] hover:bg-[var(--pt-accent-soft)]'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleSymptom(id)}
                          className="mt-0.5 size-4 shrink-0 accent-[var(--pt-accent)]"
                        />
                        <span>{symptomLabel(id)}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          {/* Kết quả. Dán ở đầu trên mobile vì người đang ở giữa danh sách sẽ
              không thấy mức độ ngay dưới mắt. */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div
              role="status"
              aria-live="polite"
              className={cn(
                'rounded-2xl border p-5 transition-colors duration-300',
                severityMeta.ring
              )}
            >
              <div className="flex items-center gap-2">
                <SeverityIcon className={cn('size-5 shrink-0', severityMeta.text)} aria-hidden="true" />
                <p className={cn('text-sm font-bold', severityMeta.text)}>
                  {t('tools.checkResult')}
                </p>
              </div>
              <p className="pt-heading mt-2 text-lg font-bold">{severityMeta.label}</p>

              {/* Thanh mức độ: giúp thấy ngay "một dấu hiệu" đã đỏ chưa, thay vì
                  phải đọc xong đoạn văn mới hiểu. */}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgb(var(--pt-border-rgb)/0.16)]">
                <motion.div
                  className={cn('h-full rounded-full', severityMeta.bar)}
                  animate={{ width: `${triage.score}%` }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>

              <p className="mt-3 text-sm leading-relaxed">{t(triage.adviceKey)}</p>

              {/* Liệt kê đúng những dấu hiệu nguy hiểm ĐÃ TICK, không phải cả
                  nhóm. Trước đây in `symptoms[0]` của mỗi nhóm là in cả nhãn
                  của ô người dùng không chọn — đọc xong tưởng mình có thêm
                  triệu chứng. */}
              {criticalChecked.length > 0 && (
                <p className="mt-3 border-t border-[rgb(var(--pt-border-rgb)/0.14)] pt-3 text-xs leading-relaxed">
                  {criticalChecked.map(symptomLabel).join(' · ')}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {triage.severity !== 'watch' && (
                  <Link
                    href={bookHref}
                    className="pt-focus inline-flex items-center gap-1.5 rounded-full bg-[var(--pt-accent)] px-4 py-2 text-xs font-bold text-[var(--pt-on-accent)] transition-transform hover:scale-[1.03]"
                  >
                    <Stethoscope className="size-3.5" aria-hidden="true" />
                    {t('tools.ctaBook')}
                  </Link>
                )}
                <a
                  href={`tel:${HOTLINE}`}
                  className={cn(
                    'pt-focus inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition-colors hover:bg-[var(--pt-accent-soft)]',
                    triage.severity === 'urgent'
                      ? 'border-[var(--pt-danger)] text-[var(--pt-danger)]'
                      : 'border-[rgb(var(--pt-border-rgb)/0.24)]'
                  )}
                >
                  <PhoneCall className="size-3.5" aria-hidden="true" />
                  {t('tools.ctaCall')} · {HOTLINE_DISPLAY}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cảnh báo chẩn đoán — lặp lại ở cấp trang, không chỉ ở từng công cụ.
          Đặt ngay dưới kết quả thì đọc xong quên; đặt ở đây thì ai cuộn tới
          cuối cũng phải qua. */}
      <p className="pt-glass mt-6 flex items-start gap-2.5 p-4 text-sm leading-relaxed">
        <Info className="mt-0.5 size-4 shrink-0 text-[var(--pt-accent)]" aria-hidden="true" />
        <span>{t('tools.disclaimer')}</span>
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Nút chọn loài — Dog/Cat.
   ──────────────────────────────────────────────────────────────────────────── */

function KindToggle({
  value,
  onChange,
  labels,
}: {
  value: PetKind;
  onChange: (kind: PetKind) => void;
  labels: { dog: string; cat: string };
}) {
  return (
    <div
      role="radiogroup"
      className="flex shrink-0 gap-1 rounded-full border border-[rgb(var(--pt-border-rgb)/0.18)] bg-[var(--pt-accent-soft)] p-1"
    >
      {(['dog', 'cat'] as const).map((kind) => {
        const active = value === kind;
        const Icon = kind === 'dog' ? Dog : Cat;
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(kind)}
            className={cn(
              'pt-focus relative inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors',
              active
                ? 'bg-[var(--pt-accent)] text-[var(--pt-on-accent)]'
                : 'hover:bg-[var(--pt-accent-soft)]'
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {labels[kind]}
          </button>
        );
      })}
    </div>
  );
}

/** Xuất lại để trang khác dùng chung danh sách mã triệu chứng nếu cần. */
export { ALL_SYMPTOM_IDS };