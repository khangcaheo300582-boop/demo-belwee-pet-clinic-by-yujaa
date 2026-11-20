'use client';

// components/staff/StaffCustomerCareCard.tsx
// Thẻ Liquid Glass hiển thị yêu cầu chăm sóc khách hàng đang được "chào" cho
// chính thành viên này, với đúng hai nút nghiệp vụ:
//
//   Tiếp nhận  → phiên chuyển thành accepted, người đó được đưa tới
//                /staff/customer-care?session=… để chat với khách;
//   Loại bỏ    → ghi nhận tên mình vào `declined`, hệ thống chào lại cho nhân
//                viên/bác sĩ đang online kế tiếp; hết người online thì cả
//                khách lẫn card đều thấy trạng thái "bận".
//
// Nguồn dữ liệu: kênh SSE `staff:care` (lib/realtime.ts). Khi mới mount, phần
// "chào" còn treo từ trước được lấy lại bằng GET /api/customer/care/respond —
// SSE chỉ mang tin MỚI, không phải nguồn thật sự (persist is authoritative).

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Loader2, MessageCircleHeart, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CareOffer {
  sessionId: string;
  customerName: string;
  createdAt: string;
  /** Bị set khi tin đến từ SSE — để chặn lọc đúng người ở render (server đã chặn quyền). */
  staffId?: string;
}

interface AcceptedRow {
  sessionId: string;
  customerName: string;
  acceptedAt: string;
}

/** Thẻ chỉ đóng vai trò thông báo sau khi tiếp nhận — tự ẩn sau 5 giây. */
const CHIP_AUTO_HIDE_MS = 5_000;
/** Chỉ thông báo phiên vừa được tiếp nhận, không hồi sinh thẻ của phiên cũ. */
const CHIP_NOTIFY_WINDOW_MS = 60_000;
/**
 * Những phiên ĐÃ được báo tiếp nhận trong tab này.
 *
 * Thẻ "Phiên chăm sóc đang mở" là thông báo một lần: hiện 5 giây rồi biến
 * mất. Nếu chỉ nhớ trong RAM, tải lại trang (F5) trong vòng 60 giây sau khi
 * tiếp nhận sẽ làm nó sống dậy thêm 5 giây nữa — đúng hiện tượng "đã vào
 * phiên chat mà thẻ vẫn hiển thị". Ghi vào sessionStorage để lần mount sau
 * biết là đã báo rồi.
 */
const NOTIFIED_STORAGE_KEY = 'belwee-care-accepted-notified-v1';

function readNotifiedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(NOTIFIED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function rememberNotifiedId(sessionId: string): void {
  try {
    const ids = readNotifiedIds();
    ids.add(sessionId);
    // Chỉ giữ 20 mục gần nhất — đây là thông báo tạm, không phải nhật ký.
    sessionStorage.setItem(
      NOTIFIED_STORAGE_KEY,
      JSON.stringify([...ids].slice(-20))
    );
  } catch {
    /* Safari riêng tư chặn storage — thẻ vẫn tự ẩn sau 5 giây */
  }
}

export default function StaffCustomerCareCard() {
  const [meId, setMeId] = useState<string | null>(null);
  const [offers, setOffers] = useState<CareOffer[]>([]);
  const [accepted, setAccepted] = useState<AcceptedRow[]>([]);
  const [busySession, setBusySession] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  /** sessionId → timeout ẩn thẻ; thẻ đã ẩn không được thêm lại bởi lần fetch sau. */
  const chipTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const dismissedChipsRef = useRef<Set<string>>(new Set());
  /**
   * Ảnh chụp danh sách "đã báo" lúc mount. Đóng băng có chủ đích: nếu đọc lại
   * sau mỗi lần ghi, lần refresh thứ hai (StrictMode / SSE mở lại) sẽ lọc mất
   * chính thẻ vừa lên lịch và thông báo không bao giờ hiện.
   */
  const alreadyNotifiedRef = useRef<Set<string> | null>(null);
  const previouslyNotified = useCallback(() => {
    if (!alreadyNotifiedRef.current) alreadyNotifiedRef.current = readNotifiedIds();
    return alreadyNotifiedRef.current;
  }, []);

  const scheduleChipHide = useCallback((sessionId: string) => {
    // Đánh dấu NGAY khi thẻ được lên lịch: thông báo chỉ xuất hiện một lần
    // cho mỗi phiên, kể cả khi người dùng tải lại trang ngay sau đó.
    rememberNotifiedId(sessionId);
    if (chipTimersRef.current.has(sessionId)) return;
    const timer = setTimeout(() => {
      chipTimersRef.current.delete(sessionId);
      dismissedChipsRef.current.add(sessionId);
      setAccepted((prev) => prev.filter((row) => row.sessionId !== sessionId));
    }, CHIP_AUTO_HIDE_MS);
    chipTimersRef.current.set(sessionId, timer);
  }, []);

  // Dọn timer khi rời trang nhân viên.
  useEffect(
    () => () => {
      for (const timer of chipTimersRef.current.values()) clearTimeout(timer);
      chipTimersRef.current.clear();
    },
    []
  );

  const refreshMine = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/care/respond', { cache: 'no-store' });
      if (!res.ok) return;
      const payload = (await res.json().catch(() => null)) as
        | { offered?: CareOffer[]; accepted?: AcceptedRow[] }
        | null;
      if (!payload) return;
      setOffers(payload.offered ?? []);
      const now = Date.now();
      const fresh = (payload.accepted ?? []).filter((row) => {
        if (dismissedChipsRef.current.has(row.sessionId)) return false;
        // Đã báo ở lần mount trước (F5 / chuyển trang) ⇒ không báo lại.
        if (previouslyNotified().has(row.sessionId)) return false;
        const acceptedAt = new Date(row.acceptedAt).getTime();
        return Number.isFinite(acceptedAt) && now - acceptedAt <= CHIP_NOTIFY_WINDOW_MS;
      });
      setAccepted(fresh);
      for (const row of fresh) scheduleChipHide(row.sessionId);
    } catch {
      /* offline — SSE keeps the card alive meanwhile */
    }
  }, [scheduleChipHide, previouslyNotified]);

  // Ai đang đăng nhập (chỉ để biết card này có dành cho mình không).
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/staff/me', { cache: 'no-store' });
        if (!res.ok) return;
        const payload = (await res.json().catch(() => null)) as { staff?: { id?: string } | null };
        setMeId(payload?.staff?.id ?? null);
      } catch {
        /* bỏ qua */
      }
    })();
  }, []);

  // Danh sách ban đầu + SSE realtime.
  useEffect(() => {
    void refreshMine();

    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    try {
      const source = new EventSource('/api/realtime/stream?channels=staff:care');
      sourceRef.current = source;

      const onOffered = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as CareOffer & { staffId?: string };
          setOffers((prev) =>
            prev.some((row) => row.sessionId === data.sessionId)
              ? prev
              : [...prev, { sessionId: data.sessionId, customerName: data.customerName, createdAt: data.createdAt, staffId: data.staffId }].slice(-4)
          );
        } catch {
          /* frame hỏng bỏ qua */
        }
      };
      const onAccepted = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as { sessionId?: string; customerName?: string };
          if (!data.sessionId) return;
          setOffers((prev) => prev.filter((row) => row.sessionId !== data.sessionId));
        } catch {
          /* bỏ qua */
        }
      };
      const onBusy = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as { sessionId?: string };
          if (!data.sessionId) return;
          setOffers((prev) => prev.filter((row) => row.sessionId !== data.sessionId));
        } catch {
          /* bỏ qua */
        }
      };

      source.addEventListener('care:offered', onOffered as EventListener);
      source.addEventListener('care:accepted', onAccepted as EventListener);
      source.addEventListener('care:busy', onBusy as EventListener);
      return () => {
        source.removeEventListener('care:offered', onOffered as EventListener);
        source.removeEventListener('care:accepted', onAccepted as EventListener);
        source.removeEventListener('care:busy', onBusy as EventListener);
        source.close();
        sourceRef.current = null;
      };
    } catch {
      /* không có SSE thì poll định kỳ vẫn đủ dùng */
    }
    // ~ `meId` không nằm trong deps: một EventSource dùng chung là đủ, quyền
    // chào ai vẫn do server chặn. Phần khớp với "mình" được lọc ở render.
  }, [refreshMine]);

  const handleAccept = useCallback(async (sessionId: string) => {
    setError(null);
    setBusySession(sessionId);
    try {
      const res = await fetch('/api/customer/care/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'accept' }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { chatUrl?: string; error?: string }
        | null;
      if (!res.ok || !payload?.chatUrl) {
        setError(payload?.error || 'Không tiếp nhận được yêu cầu.');
        setOffers((prev) => prev.filter((row) => row.sessionId !== sessionId));
        return;
      }
      setOffers((prev) => prev.filter((row) => row.sessionId !== sessionId));
      window.location.assign(payload.chatUrl);
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setBusySession(null);
    }
  }, []);

  const handleDecline = useCallback(async (sessionId: string) => {
    setError(null);
    setBusySession(sessionId);
    try {
      const res = await fetch('/api/customer/care/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'decline' }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error || 'Không loại bỏ được yêu cầu.');
      }
      setOffers((prev) => prev.filter((row) => row.sessionId !== sessionId));
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setBusySession(null);
    }
  }, []);

  // SSE chỉ là thông báo; chính server (respond route) quyết định ai được chào.
  const visibleOffers = offers.filter(
    (row) => !row.staffId || !meId || row.staffId === meId
  );

  return (
    <>
      {/* Dải “đang chat” gắn trên cùng: nhắc thành viên đã có phiên đang mở */}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-[105] flex flex-col items-center gap-2 px-4">
        {/* Không bọc AnimatePresence: thẻ là thông báo tự hết hạn, phải được
            gỡ khỏi DOM ngay khi hết 5 giây — exit animation có thể bị treo ở
            tab nền và để lại một vùng bấm vô hình. */}
        {accepted.slice(-3).map((row) => (
          <motion.div
            key={row.sessionId}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="pointer-events-auto"
          >
            <a
              href={`/staff/customer-care?session=${encodeURIComponent(row.sessionId)}`}
              className="group flex items-center gap-3 rounded-[22px] border border-emerald-300/20 bg-gradient-to-r from-emerald-400/[0.12] to-blue-400/[0.10] px-5 py-3 shadow-[0_16px_44px_-16px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-gradient-to-br from-emerald-300/25 to-blue-300/20 border border-white/10">
                <MessageCircleHeart className="h-4 w-4 text-emerald-200" />
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-extrabold tracking-tight text-white">
                  {row.customerName}
                </span>
                <span className="block text-[10.5px] text-emerald-200/70">
                  Phiên chăm sóc đang mở — nhấn để trò chuyện
                </span>
              </span>
              <ArrowRight className="ml-2 h-4 w-4 shrink-0 text-emerald-200 transition-transform group-hover:translate-x-0.5" />
            </a>
          </motion.div>
        ))}

        <AnimatePresence>
          {visibleOffers.map((offer) => (
            <motion.div
              key={offer.sessionId}
              initial={{ opacity: 0, x: 48, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26, duration: 0.35 }}
              className="pointer-events-auto w-[360px] max-w-[94vw] overflow-hidden rounded-[26px] border border-white/[0.10] bg-gradient-to-b from-white/[0.10] to-[#070b16]/60 shadow-[0_36px_90px_-22px_rgba(2,6,23,0.75),inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-3xl"
              role="alertdialog"
              aria-label={`Khách hàng ${offer.customerName} đang yêu cầu trò chuyện`}
            >
              {/* Ánh sáng phản chiếu kiểu liquid glass */}
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="absolute -top-14 left-6 h-24 w-48 rounded-full bg-emerald-300/10 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-20 w-40 rounded-full bg-blue-300/[0.08] blur-3xl" />
              </div>

              <div className="relative p-5">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-emerald-300/20 to-blue-400/15 border border-white/[0.12] shadow-[0_0_20px_-6px_rgba(34,197,94,0.35)]">
                    <MessageCircleHeart className="h-5 w-5 text-emerald-200" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300/70">
                      Yêu cầu chăm sóc khách hàng
                    </p>
                    <h3 className="mt-1 truncate text-[17px] font-extrabold tracking-tight text-white">
                      {offer.customerName}
                    </h3>
                    <p className="mt-0.5 text-[12px] leading-[1.6] text-white/55">
                      Khách hàng yêu cầu liên hệ trò chuyện. Tiếp nhận để vào trang
                      chăm sóc khách hàng và hỗ trợ bé ngay.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => void handleAccept(offer.sessionId)}
                    disabled={busySession === offer.sessionId}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 px-4 py-2.5',
                      'text-[12px] font-extrabold tracking-wide text-slate-950 shadow-[0_4px_18px_rgba(34,197,94,0.35)]',
                      'hover:brightness-110 active:scale-[0.97] transition',
                      busySession === offer.sessionId && 'opacity-60'
                    )}
                  >
                    {busySession === offer.sessionId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Tiếp nhận
                  </button>
                  <button
                    onClick={() => void handleDecline(offer.sessionId)}
                    disabled={busySession === offer.sessionId}
                    className="flex items-center justify-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-[12px] font-bold tracking-wide text-white/70 hover:bg-white/[0.12] hover:text-white active:scale-[0.97] transition"
                  >
                    {busySession === offer.sessionId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    Loại bỏ
                  </button>
                </div>

                {error && (
                  <p className="mt-2.5 text-center text-[11px] font-medium text-amber-200">{error}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
