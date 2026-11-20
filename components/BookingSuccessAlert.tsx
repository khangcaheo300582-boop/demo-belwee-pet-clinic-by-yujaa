'use client';

/**
 * components/BookingSuccessAlert.tsx
 *
 * Toast báo "Xác nhận đặt lịch thành công!!" cho khách, xuất hiện góc dưới
 * bên phải khi nhân viên xác nhận lịch (hoặc khi lịch bị hủy).
 *
 * ── VÌ SAO TUYỆT ĐỐI KHÔNG TỰ TẮT ───────────────────────────────────────────
 * Yêu cầu: chỉ đóng bằng nút X, không setTimeout. Lý do thật — đây là thông
 * báo có việc phải làm (khách phải biết lịch đã chốt và đến đúng giờ), nếu
 * tự biến mất sau mấy giây thì khách đang lướt trang khác sẽ không bao giờ
 * thấy. Vì vậy tuổi thọ của một toast là do người dùng quyết định, không phải
 * do bộ đếm thời gian.
 *
 * ── VÌ SAO XÓA LUÔN KHỎI DOM KHI ĐÓNG ──────────────────────────────────────
 * dismiss() ở component cha đã lọc item khỏi mảng. Giữ lại một bản ghi ẩn chỉ
 * để "ghi nhớ đã đóng" là thừa — lần tải sau danh sách được đánh dấu đã đọc
 * phía server nên toast cũ không quay lại, và nếu nó quay lại thì đúng nghĩa
 * là có thông báo MỚI chứ không phải cái cũ.
 *
 * ── TRUYỀN THẤP VIỆC HIỂN THỊ ───────────────────────────────────────────────
 * enabled=false → trả về null, KHÔNG mở EventSource, không gọi API. Đây là điều
 * kiện bắt buộc về mặt riêng tư: khách đã tắt thông báo thì không nên bị giữ
 * một kết nối mở, cũng không nên nhận dữ liệu họ đã từ chối.
 */

import { useCallback } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import type { MessageKey } from '@/lib/i18n';

export interface BookingAlertItem {
  id: string;
  /** 'confirmed' = nhân viên đã chốt lịch; 'cancelled' = lịch bị hủy. */
  kind: 'confirmed' | 'cancelled';
  title: string;
  /** Dòng phụ đã được server dựng sẵn: tên thú + giờ hẹn (hoặc lý do hủy). */
  body: string;
  staffName: string | null;
  staffAvatarUrl: string | null;
  createdAt: string;
}

/** Nhãn cho phần trang trí, không phụ thuộc ngôn ngữ (chỉ là icon). */
function KindGlyph({ kind }: { kind: BookingAlertItem['kind'] }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-base"
      style={{
        background: kind === 'confirmed' ? 'var(--pt-accent-soft)' : 'rgb(248 113 113 / 0.16)',
      }}
    >
      {kind === 'confirmed' ? '✅' : '⚠️'}
    </span>
  );
}

/**
 * Huy hiệu số thông báo chưa đọc. Tách riêng khỏi toast vì nơi dùng (profile
 * page) muốn gắn badge vào một mục menu, không phải trong góc màn hình.
 */
export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="ml-auto inline-grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1.5 text-[11px] font-bold text-[var(--pt-on-accent)]"
      style={{ background: 'var(--pt-accent)' }}
      aria-label={String(count)}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function BookingSuccessAlert({
  enabled,
  items,
  onDismiss,
}: {
  enabled: boolean;
  items: BookingAlertItem[];
  onDismiss: (id: string) => void;
}) {
  const { t } = useLanguage();

  const handleClose = useCallback(
    (id: string) => {
      onDismiss(id);
    },
    [onDismiss]
  );

  if (!enabled || items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[min(23rem,calc(100vw-2rem))] flex-col gap-2.5"
      // polite: đọc sau nội dung đang có, không cắt ngang lời đọc màn hình hiện tại
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="pt-glass pt-glass-strong pointer-events-auto relative overflow-hidden rounded-2xl p-3.5 pr-10 pt-slide-up"
          data-testid="booking-success-alert"
        >
          <div className="flex items-start gap-3">
            <KindGlyph kind={item.kind} />

            <div className="min-w-0 flex-1">
            {/* Tiêu đề do server dựng ("Xác nhận đặt lịch thành công!!") — giữ
                nguyên để phía backend chủ động đổi câu chữ mà không phải sửa
                component. */}
            <p className="pt-heading text-sm font-extrabold leading-snug">{item.title}</p>

            {item.body && (
              <p className="pt-muted mt-1 text-xs leading-relaxed">{item.body}</p>
            )}

            {item.staffName && (
              <div className="mt-2.5 flex items-center gap-2">
                {item.staffAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.staffAvatarUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full object-cover ring-1 ring-white/25"
                    data-theme-dim="true"
                    loading="lazy"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold"
                    style={{ background: 'var(--pt-accent-soft)', color: 'var(--pt-fg)' }}
                  >
                    {item.staffName.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="pt-muted text-[11px]">
                  {t('home.bookingAlert.confirmedBy' as MessageKey)}{' '}
                  <strong className="pt-heading font-bold">{item.staffName}</strong>
                </span>
              </div>
            )}
            </div>
          </div>

          {/* Nút X là đường thoát DUY NHẤT — không có timeout, không auto-dismiss. */}
          <button
            type="button"
            onClick={() => handleClose(item.id)}
            aria-label={t('home.bookingAlert.closeAria' as MessageKey)}
            className="pt-focus absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-base leading-none transition-transform hover:scale-110 active:scale-95"
            style={{ color: 'var(--pt-fg-muted)' }}
          >
            <span aria-hidden="true">×</span>
          </button>

          {/* Vạch nhấn màu bên trái: đọc được trạng thái (chốt/hủy) mà không
              cần dựa vào màu chữ. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{
              background:
                item.kind === 'confirmed' ? 'var(--pt-ok)' : 'var(--pt-danger)',
            }}
          />
        </div>
      ))}
    </div>
  );
}