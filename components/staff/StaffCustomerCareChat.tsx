'use client';

// components/staff/StaffCustomerCareChat.tsx
// Khung chat một-một giữa nhân viên/bác sĩ và khách hàng trong phiên chăm sóc.
//
// REALTIME
//   EventSource `staff:care` mang care:message cho CẢ HƯỚNG của phiên này:
//   tin của khách (POST /api/customer/chat) và tin của chính mình (POST
//   /api/staff/chat/customer) đều được server publish cùng một sự kiện, nên một
//   listener lọc trùng theo id là đủ. Poll 15s chỉ là lưới an toàn khi SSE
//   chết chứ không phải nguồn chính — persist (lib/dbChat) là chuẩn.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  ImagePlus,
  Loader2,
  SendHorizonal,
  ShieldCheck,
  Stethoscope,
  X,
  ZoomIn,
} from 'lucide-react';
import type { ChatMessage } from '@/lib/chatShared';
import { MAX_TEXT_LENGTH } from '@/lib/chatShared';
import { compressImage, approximateKb } from '@/lib/imageCompress';
import { cn } from '@/lib/utils';

interface Props {
  staff: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    branchId: string;
  };
  sessionId: string;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function StaffCustomerCareChat({ staff, sessionId }: Props) {
  const [customerName, setCustomerName] = useState<string>('Khách hàng');
  const [ready, setReady] = useState<'checking' | 'active' | 'denied'>('checking');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<ChatMessage | null>(null);
  /** Khách đang gõ — đến từ SSE `care:typing` (kênh staff:care). */
  const [customerTyping, setCustomerTyping] = useState(false);

  const lastSeenRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const atBottomRef = useRef(true);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  /** Ẩn chỉ báo nếu mất tín hiệu blur (đóng tab, mạng rớt) — TTL phía server 8s. */
  const typingHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staffTypingBeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const staffTypingActiveRef = useRef(false);

  /** Merge by id, keeps chronological order — both SSE and polls feed this. */
  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const known = new Set(prev.map((row) => row.id));
      const next = [...prev];
      for (const row of incoming) {
        if (!known.has(row.id)) {
          next.push(row);
          known.add(row.id);
        }
      }
      next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      lastSeenRef.current = next[next.length - 1]?.createdAt ?? lastSeenRef.current;
      return next;
    });
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // ─── Khách đang nhập (SSE care:typing) ─────────────────────────────────
  const hideCustomerTyping = useCallback(() => {
    if (typingHideRef.current) {
      clearTimeout(typingHideRef.current);
      typingHideRef.current = null;
    }
    setCustomerTyping(false);
  }, []);

  const showCustomerTyping = useCallback(() => {
    setCustomerTyping(true);
    if (typingHideRef.current) clearTimeout(typingHideRef.current);
    // Khách gửi `false` khi blur; timer này chỉ là lưới an toàn cuối cùng.
    typingHideRef.current = setTimeout(() => {
      typingHideRef.current = null;
      setCustomerTyping(false);
    }, 10_000);
  }, []);

  // ─── Nhân viên đang nhập → khách đọc qua poll 3 giây ───────────────────
  const postStaffTyping = useCallback(
    (typing: boolean) => {
      void fetch('/api/customer/care/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, typing, role: 'staff' }),
        keepalive: true,
      }).catch(() => {
        /* server tự hết hạn sau 8 giây — heartbeat sẽ thử lại */
      });
    },
    [sessionId]
  );

  const stopStaffTyping = useCallback(() => {
    if (staffTypingBeatRef.current) {
      clearInterval(staffTypingBeatRef.current);
      staffTypingBeatRef.current = null;
    }
    if (staffTypingActiveRef.current) {
      staffTypingActiveRef.current = false;
      postStaffTyping(false);
    }
  }, [postStaffTyping]);

  const startStaffTyping = useCallback(() => {
    if (staffTypingActiveRef.current) return;
    staffTypingActiveRef.current = true;
    postStaffTyping(true);
    staffTypingBeatRef.current = setInterval(() => postStaffTyping(true), 4_000);
  }, [postStaffTyping]);

  // Unmount khi ô soạn đang focus: gửi false lần cuối, dọn mọi timer.
  useEffect(
    () => () => {
      if (typingHideRef.current) {
        clearTimeout(typingHideRef.current);
        typingHideRef.current = null;
      }
      stopStaffTyping();
    },
    [stopStaffTyping]
  );

  // ─── Phiên + lịch sử ban đầu ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/customer/care?sessionId=${encodeURIComponent(sessionId)}`, {
          cache: 'no-store',
        });
        const payload = (await res.json().catch(() => null)) as
          | { status?: string; customerName?: string; staff?: { id?: string } | null }
          | null;
        if (!res.ok || !payload) throw new Error('Không đọc được phiên chăm sóc.');
        if (cancelled) return;
        setCustomerName(payload.customerName || 'Khách hàng');
        // Chỉ personnel đã TIẾP NHẬN phiên này mới được xem — double check trên
        // client, server chặn dựa trên staff session của mỗi request.
        if (payload.status === 'accepted' && payload.staff?.id && payload.staff.id !== staff.id) {
          setReady('denied');
          return;
        }
        if (payload.status !== 'accepted') {
          setReady('denied');
          return;
        }
        setReady('active');

        const history = await fetch(`/api/staff/chat/customer?sessionId=${encodeURIComponent(sessionId)}`, {
          cache: 'no-store',
        });
        const historyPayload = (await history.json().catch(() => null)) as
          | { messages?: ChatMessage[] }
          | null;
        if (history.ok && historyPayload?.messages) {
          mergeMessages(historyPayload.messages);
          requestAnimationFrame(() => scrollToBottom('auto'));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Không tải được phiên.');
          setReady('denied');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staff.id, sessionId, mergeMessages, scrollToBottom]);

  // ─── Realtime + fallback poll ───────────────────────────────────────────
  useEffect(() => {
    if (ready !== 'active') return;

    const poll = async () => {
      const since = lastSeenRef.current ? `&since=${encodeURIComponent(lastSeenRef.current)}` : '';
      try {
        const res = await fetch(`/api/staff/chat/customer?sessionId=${encodeURIComponent(sessionId)}${since}`, {
          cache: 'no-store',
        });
        const payload = (await res.json().catch(() => null)) as { messages?: ChatMessage[] } | null;
        if (res.ok && payload?.messages) {
          mergeMessages(payload.messages);
          requestAnimationFrame(() => scrollToBottom('auto'));
        }
      } catch {
        /* bỏ qua — nhịp sau sẽ thử lại */
      }
    };

    let cleanupSource: (() => void) | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    if (typeof EventSource !== 'undefined') {
      try {
        const source = new EventSource('/api/realtime/stream?channels=staff:care');
        source.addEventListener('care:message', (event: MessageEvent<string>) => {
          try {
            const data = JSON.parse(event.data) as { sessionId?: string; message?: ChatMessage };
            if (data.sessionId !== sessionIdRef.current || !data.message) return;
            mergeMessages([data.message]);
            // Tin nhắn đến nghĩa là khách đã gửi xong — tắt chỉ báo ngay.
            hideCustomerTyping();
            requestAnimationFrame(() => scrollToBottom('auto'));
          } catch {
            /* frame hỏng bỏ qua */
          }
        });
        source.addEventListener('care:typing', (event: MessageEvent<string>) => {
          try {
            const data = JSON.parse(event.data) as {
              sessionId?: string;
              role?: string;
              typing?: boolean;
            };
            if (data.sessionId !== sessionIdRef.current || data.role !== 'customer') return;
            if (data.typing) showCustomerTyping();
            else hideCustomerTyping();
          } catch {
            /* frame hỏng bỏ qua */
          }
        });
        cleanupSource = () => source.close();
      } catch {
        /* fallback poll đảm nhiệm */
      }
    }

    interval = setInterval(() => void poll(), 15_000);
    void poll();

    return () => {
      cleanupSource?.();
      if (interval) clearInterval(interval);
    };
  }, [ready, sessionId, mergeMessages, scrollToBottom, showCustomerTyping, hideCustomerTyping]);

  // ─── Autoscroll chỉ khi người đang đọc ở đáy ───────────────────────────
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (atBottomRef.current) scrollToBottom();
  }, [messages, customerTyping, scrollToBottom]);

  // ─── Gửi ────────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text && !pendingImage) return;
    if (pendingImage && !text) {
      setError('Hãy viết một mô tả ngắn cho ảnh của bé.');
      return;
    }
    setSending(true);
    setError(null);
    const image = pendingImage;
    setPendingImage(null);
    setDraft('');

    try {
      const res = await fetch('/api/staff/chat/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, text, imageDataUrl: image }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { message?: ChatMessage; error?: string }
        | null;
      if (!res.ok || !payload?.message) {
        throw new Error(payload?.error || 'Không thể gửi tin nhắn.');
      }
      // care:message SSE đã đưa tin nhắn này về listener — merge lọc trùng id.
      mergeMessages([payload.message]);
      requestAnimationFrame(() => scrollToBottom());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể gửi tin nhắn.');
      // Cho sửa lại: trả nội dung về khung soạn.
      setDraft(text);
      if (image) setPendingImage(image);
    } finally {
      setSending(false);
    }
  }, [draft, pendingImage, sessionId, mergeMessages, scrollToBottom]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCompressing(true);
    const dataUrl = await compressImage(file);
    setCompressing(false);
    if (!dataUrl) {
      setError('Ảnh không đọc được hoặc quá lớn (tối đa ~1,2MB sau nén).');
      return;
    }
    setPendingImage(dataUrl);
  }, []);

  // ─── Guard ──────────────────────────────────────────────────────────────
  if (ready === 'denied') {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-70px)] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/10 bg-gradient-to-br from-amber-300/15 to-amber-400/10">
          <ShieldCheck className="h-6 w-6 text-amber-200" />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-white">Phiên không còn ở đây</h1>
        <p className="max-w-sm text-[13px] leading-relaxed text-white/55">
          Phiên chăm sóc <span className="font-semibold text-white/80">{customerName}</span> đã kết
          thúc, hết hạn hoặc đã được thành viên khác xử lý.
        </p>
        <Link
          href="/staff/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 px-5 py-2.5 text-[12px] font-extrabold tracking-wide text-slate-950 shadow-[0_4px_18px_rgba(34,197,94,0.3)] transition hover:brightness-110"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Về bảng điều khiển
        </Link>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex h-[calc(100dvh-70px)] max-w-3xl flex-col px-4 sm:px-6">
      {/* Header phiên */}
      <header className="relative z-10 pt-6 pb-2">
        <div className="flex items-center justify-between rounded-[24px] border border-white/[0.08] bg-white/[0.04] px-5 py-4 shadow-[0_24px_60px_-16px_rgba(2,6,23,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.1] bg-gradient-to-br from-emerald-300/20 to-blue-400/15 shadow-[0_0_16px_-6px_rgba(34,197,94,0.25)]">
              <Stethoscope className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-extrabold tracking-tight text-white">
                {customerName}
              </h1>
              <p className="text-[11px] text-white/40">
                Chăm sóc khách hàng trực tuyến · {sessionId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 shadow-sm">
              <Loader2 className="size-2.5 animate-spin" style={{ animationDuration: '4s' }} />
              Đang trò chuyện
            </span>
            <Link
              href="/staff/dashboard"
              aria-label="Về bảng điều khiển"
              title="Về bảng điều khiển"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/60 transition hover:bg-white/[0.12] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Tin nhắn */}
      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-[24px] bg-gradient-to-b from-white/[0.03] to-transparent px-3 py-4 scroll-smooth sm:px-4"
      >
        <div className="mb-4 flex justify-center">
          <div className="rounded-full border border-white/[0.08] bg-gradient-to-r from-emerald-400/15 to-blue-400/15 px-4 py-1.5 shadow-[0_0_20px_-8px_rgba(34,197,94,0.15)] backdrop-blur-xl">
            <p className="text-[11px] font-medium tracking-wide text-emerald-200/90">
              Bạn đã tiếp nhận yêu cầu — chuyên trò với khách hàng bắt đầu từ đây.
            </p>
          </div>
        </div>

        {messages.map((message) => {
          const mine = message.staffId === staff.id;
          return (
            <div key={message.id} className={cn('mb-3 flex gap-2.5', mine ? 'flex-row-reverse' : 'flex-row')}>
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br shadow-[0_0_12px_-4px_rgba(34,197,94,0.3)]',
                  mine ? 'from-blue-300/25 to-emerald-300/20' : 'from-emerald-300/20 to-blue-300/20'
                )}
              >
                {mine ? (
                  <span className="text-[10px] font-extrabold text-slate-950">{staff.name.slice(0, 1).toUpperCase()}</span>
                ) : message.recalled ? (
                  <X className="h-4 w-4 text-white/40" />
                ) : (
                  <span className="text-[10px] font-extrabold text-emerald-200">
                    {(customerName || 'K').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <div
                className={cn(
                  'max-w-[82%] rounded-[20px] border px-4 py-3 shadow-sm backdrop-blur-xl',
                  mine
                    ? 'rounded-br-md border-blue-300/15 bg-gradient-to-r from-blue-500/15 to-emerald-400/10 text-white shadow-[0_2px_12px_rgba(59,130,246,0.12)]'
                    : 'rounded-bl-md border-white/[0.1] bg-gradient-to-br from-white/[0.06] to-white/[0.03] text-white shadow-[0_2px_12px_rgba(2,6,23,0.25)]'
                )}
              >
                <p className="mb-1 text-[10px] font-extrabold tracking-wide text-emerald-200">
                  {mine ? 'Bạn' : customerName}
                </p>
                {message.recalled ? (
                  <p className="text-[13px] italic leading-[1.7] text-white/40">Tin nhắn đã được thu hồi.</p>
                ) : (
                  <>
                    {message.text && (
                      <p className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.7] text-white/90">
                        {message.text}
                      </p>
                    )}
                    {message.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setLightbox(message)}
                        className="group relative mt-2 block w-full overflow-hidden rounded-xl border border-white/10 shadow-inner"
                        aria-label="Mở ảnh lớn"
                      >
                        <img src={message.imageUrl} alt="Ảnh trong phiên chat" className="max-h-56 w-full object-cover" />
                        <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/60 text-white/80 opacity-0 transition group-hover:opacity-100">
                          <ZoomIn className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    )}
                  </>
                )}
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-white/30">
                  <Clock className="h-2.5 w-2.5" />
                  <time dateTime={message.createdAt}>{timeOf(message.createdAt)}</time>
                </div>
              </div>
            </div>
          );
        })}

        {/* Khách đang nhập — hiện khi ô soạn của khách còn focus */}
        {customerTyping && (
          <div className="mb-3 flex flex-row gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-emerald-300/20 to-blue-300/20 shadow-[0_0_12px_-4px_rgba(34,197,94,0.3)]">
              <span className="text-[10px] font-extrabold text-emerald-200">
                {(customerName || 'K').slice(0, 1).toUpperCase()}
              </span>
            </span>
            <div className="rounded-[20px] rounded-bl-md border border-white/[0.1] bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-4 py-3 shadow-[0_2px_12px_rgba(2,6,23,0.25)] backdrop-blur-xl">
              <p className="mb-1.5 text-[10px] font-extrabold tracking-wide text-emerald-200">
                {customerName} đang nhập…
              </p>
              <span className="flex items-center gap-1.5" role="status" aria-label="Khách hàng đang nhập">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                    className="block size-[5px] rounded-full bg-emerald-300/80"
                  />
                ))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Soạn tin */}
      <div className="sticky bottom-0 z-10 pb-4 pt-3">
        {error && (
          <p className="mb-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-center text-[11px] font-medium text-amber-200">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2 rounded-[24px] border border-white/[0.08] bg-white/[0.04] px-4 py-3 shadow-[0_8px_32px_-8px_rgba(2,6,23,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFileSelect(e)} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05] text-white/50 transition shadow-[0_0_8px_rgba(255,255,255,0.05)] backdrop-blur-md hover:bg-white/[0.1] hover:text-white"
            aria-label="Đính kèm ảnh"
            title="Gửi ảnh tình trạng của bé"
          >
            {compressing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </button>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={startStaffTyping}
            onBlur={stopStaffTyping}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={MAX_TEXT_LENGTH}
            placeholder="Nhận xét ban đầu, hướng dẫn sơ cứu, gợi ý dịch vụ…"
            className="min-h-[44px] max-h-32 flex-1 resize-none rounded-2xl border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 text-[14px] text-white outline-none shadow-inner backdrop-blur-xl transition-all placeholder:text-white/25 focus:border-emerald-300/30 focus:bg-white/[0.08]"
          />

          <button
            onClick={() => void send()}
            disabled={sending || (!draft.trim() && !pendingImage)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-slate-950 shadow-[0_2px_12px_rgba(34,197,94,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Gửi tin nhắn"
          >
            {sending ? (
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <SendHorizonal className="h-4 w-4" />
              </motion.span>
            ) : (
              <SendHorizonal className="h-4 w-4" />
            )}
          </button>
        </div>
        {pendingImage && (
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 backdrop-blur-xl">
            <img src={pendingImage} alt="Ảnh sắp gửi" className="h-12 w-12 rounded-lg object-cover" />
            <span className="text-[11px] text-white/50">Ảnh đính kèm · {approximateKb(pendingImage)} KB</span>
            <button
              onClick={() => setPendingImage(null)}
              className="ml-auto rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
              aria-label="Bỏ ảnh đính kèm"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Lightbox ảnh */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-8 backdrop-blur-xl"
            onClick={() => setLightbox(null)}
          >
            <div
              className="relative max-h-[80vh] max-w-2xl overflow-hidden rounded-[24px] border border-white/[0.15] bg-gradient-to-b from-[#0b1120]/90 to-[#070b16]/90 shadow-[0_32px_80px_-24px_rgba(2,6,23,0.7)] backdrop-blur-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightbox(null)}
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
              {lightbox.imageUrl && (
                <img src={lightbox.imageUrl} alt="Ảnh trong phiên chat" className="mx-auto max-h-[70vh] w-auto rounded-[20px]" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
