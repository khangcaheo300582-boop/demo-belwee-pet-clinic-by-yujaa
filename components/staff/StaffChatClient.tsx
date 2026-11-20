'use client';

// components/staff/StaffChatClient.tsx
// /staff/chat — the internal group chat.
//
// REALTIME
//   One EventSource on /api/realtime/stream carries every channel the member is
//   entitled to (group + their own branch). Messages arrive as `chat:message`,
//   reactions as `chat:reaction`, recalls as `chat:recall`. There is also a
//   20s poll as a FALLBACK: SSE silently dies behind some corporate proxies, and
//   a chat that stops updating with no indication is worse than one that
//   occasionally double-fetches.
//
// IMAGE COMPRESSION (client-side)
//   A pasted phone photo is 3-6 MB, which as a base64 data URL would be ~8 MB of
//   JSON and blow the request budget. The file is drawn to a canvas, capped at
//   1280px and re-encoded as JPEG at q=0.72 — typically 80-200 KB — BEFORE it
//   leaves the browser. The server re-validates regardless.
//
// AUTOSCROLL
//   Only follows new messages when the reader is already at the bottom. Yanking
//   someone back down while they are reading history is the single most annoying
//   thing a chat UI can do.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CornerUpLeft,
  ImagePlus,
  Loader2,
  MessageSquare,
  Reply,
  SendHorizonal,
  Smile,
  Trash2,
  Wifi,
  WifiOff,
  X,
  ZoomIn,
} from 'lucide-react';
// Client-safe chat model. NOT from @/lib/dbChat — that module imports fs via
// lib/jsonStore for persistence, which cannot be bundled for the browser.
import {
  ALLOWED_REACTIONS,
  groupByDay,
  applyOptimisticReaction,
  PAGE_SIZE,
  type ChatMessage,
  type ChatReaction,
} from '@/lib/chatShared';
import { STAFF_CHAT_CHANNEL, branchChatChannel } from '@/lib/channels';
import { compressImage, approximateKb } from '@/lib/imageCompress';
import { cn } from '@/lib/utils';

interface Props {
  staff: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    branchId: string;
    branchCode: string;
  };
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

const MAX_LOADED_MESSAGES = PAGE_SIZE * 3;

export default function StaffChatClient({ staff }: Props) {
  const [channel, setChannel] = useState<string>(STAFF_CHAT_CHANNEL);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [lightbox, setLightbox] = useState<ChatMessage | null>(null);
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const [readState, setReadState] = useState<Record<string, string>>({});
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const channelRef = useRef(channel);
  channelRef.current = channel;
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);
  const messagesRef = useRef<ChatMessage[]>([]);
  const historyScrollRef = useRef<{ height: number; top: number } | null>(null);

  const channels = useMemo(
    () => [STAFF_CHAT_CHANNEL, branchChatChannel(staff.branchId)],
    [staff.branchId]
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // ─── Load history ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    messagesRef.current = [];
    setMessages([]);
    setHasOlderMessages(false);
    atBottomRef.current = true;
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/staff/chat?channel=${encodeURIComponent(channel)}`, {
          cache: 'no-store',
        });
        const payload = (await res.json().catch(() => null)) as
          | { messages?: ChatMessage[]; hasMore?: boolean; error?: string }
          | null;
        if (!res.ok || !payload?.messages) {
          throw new Error(payload?.error || `Lỗi ${res.status}`);
        }
        if (cancelled) return;
        messagesRef.current = payload.messages;
        setMessages(payload.messages);
        setHasOlderMessages(Boolean(payload.hasMore));
        atBottomRef.current = true;
        requestAnimationFrame(() => scrollToBottom('auto'));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Không tải được lịch sử tin nhắn.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channel, scrollToBottom]);

  // ─── Realtime ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const url = `/api/realtime/stream?channels=${encodeURIComponent(channels.join(','))}`;
    const source = new EventSource(url);

    const onSubscribed = () => setConnected(true);
    const onError = () => setConnected(false);

    const upsert = (incoming: ChatMessage) => {
      if (messagesRef.current.length >= MAX_LOADED_MESSAGES) setHasOlderMessages(true);
      setMessages((prev) => {
        const at = prev.findIndex((m) => m.id === incoming.id);
        if (at === -1) {
          const next = [...prev, incoming].slice(-MAX_LOADED_MESSAGES);
          messagesRef.current = next;
          return next;
        }
        const next = prev.slice();
        next[at] = incoming;
        messagesRef.current = next;
        return next;
      });
      if (atBottomRef.current) {
        // Defer one frame so the new row exists in the DOM before scrolling.
        requestAnimationFrame(() => scrollToBottom());
      }
    };

    const onMessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as { channel: string; data: ChatMessage };
        if (parsed.channel !== channel) return;
        setReadState((prev) => ({ ...prev, [parsed.channel]: new Date().toISOString() }));
        upsert(parsed.data);
      } catch {
        /* malformed frame — the poll below will reconcile */
      }
    };

    source.addEventListener('subscribed', onSubscribed);
    source.addEventListener('chat:message', onMessage as EventListener);
    source.addEventListener('chat:reaction', onMessage as EventListener);
    source.addEventListener('chat:recall', onMessage as EventListener);
    source.addEventListener('close', onError);
    source.onerror = onError;

    // Fallback poll. Reconciles anything SSE missed while the tab was hidden,
    // which is exactly when the background timer is also throttled, so the
    // `visibilitychange` handler is the more important half of this.
    const poll = window.setInterval(() => {
      if (document.hidden) return;
      const since = readStateRef.current[channel];
      void (async () => {
        try {
          const query = since ? `&since=${encodeURIComponent(since)}` : '';
          const res = await fetch(
            `/api/staff/chat?channel=${encodeURIComponent(channel)}${query}`,
            { cache: 'no-store' }
          );
          if (!res.ok) return;
          const data = (await res.json()) as { messages: ChatMessage[] };
          if (data.messages.length === 0) return;
          if (messagesRef.current.length >= MAX_LOADED_MESSAGES) setHasOlderMessages(true);
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const fresh = data.messages.filter((m) => !seen.has(m.id));
            if (fresh.length === 0) return prev;
            const next = [...prev, ...fresh].slice(-MAX_LOADED_MESSAGES);
            messagesRef.current = next;
            return next;
          });
        } catch {
          /* transient — next tick retries */
        }
      })();
    }, 20_000);

    const onVisible = () => {
      if (!document.hidden) {
        // Re-read rather than rely on the throttled interval.
        const since = readStateRef.current[channel];
        const query = since ? `&since=${encodeURIComponent(since)}` : '';
        void fetch(`/api/staff/chat?channel=${encodeURIComponent(channel)}${query}`, {
          cache: 'no-store',
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data: { messages?: ChatMessage[] } | null) => {
            if (!data?.messages?.length) return;
            if (messagesRef.current.length >= MAX_LOADED_MESSAGES) setHasOlderMessages(true);
            setMessages((prev) => {
              const seen = new Set(prev.map((m) => m.id));
              const fresh = data.messages!.filter((m) => !seen.has(m.id));
              if (fresh.length === 0) return prev;
              const next = [...prev, ...fresh].slice(-MAX_LOADED_MESSAGES);
              messagesRef.current = next;
              return next;
            });
          })
          .catch(() => undefined);
      }
    };

    document.addEventListener('visibilitychange', onVisible);

    return () => {
      source.removeEventListener('subscribed', onSubscribed);
      source.removeEventListener('chat:message', onMessage as EventListener);
      source.removeEventListener('chat:reaction', onMessage as EventListener);
      source.removeEventListener('chat:recall', onMessage as EventListener);
      source.removeEventListener('close', onError);
      source.close();
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // readStateRef is a ref, so excluding it is correct and exhaustive-deps clean.
  }, [channel, channels, scrollToBottom]);

  // Mirror of `readState` for the poll closure — a ref so the effect above does
  // not need to re-subscribe every time a message arrives.
  const readStateRef = useRef(readState);
  useEffect(() => {
    readStateRef.current = readState;
  }, [readState]);

  // ─── Track whether the reader is pinned to the bottom ───────────
  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    // 80px of slack: a message arriving while the user is at the very bottom
    // should still count as "following".
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function loadOlderMessages() {
    const firstMessage = messagesRef.current[0];
    if (!firstMessage || loadingOlder || !hasOlderMessages) return;
    const list = listRef.current;
    historyScrollRef.current = list
      ? { height: list.scrollHeight, top: list.scrollTop }
      : null;
    setLoadingOlder(true);
    try {
      const query = new URLSearchParams({
        channel,
        before: firstMessage.createdAt,
        beforeId: firstMessage.id,
      });
      const response = await fetch(`/api/staff/chat?${query}`, { cache: 'no-store' });
      const data = (await response.json()) as {
        messages?: ChatMessage[];
        hasMore?: boolean;
        error?: string;
      };
      if (!response.ok || !data.messages) throw new Error(data.error || 'Không tải được tin nhắn cũ.');
      if (channelRef.current !== channel) return;
      const existing = new Set(messagesRef.current.map((message) => message.id));
      const older = data.messages.filter((message) => !existing.has(message.id));
      const combined = [...older, ...messagesRef.current];
      messagesRef.current = combined;
      setMessages(combined);
      setHasOlderMessages(Boolean(data.hasMore));
      requestAnimationFrame(() => {
        const currentList = listRef.current;
        const previousScroll = historyScrollRef.current;
        if (!currentList || !previousScroll) return;
        currentList.scrollTop = previousScroll.top + currentList.scrollHeight - previousScroll.height;
        historyScrollRef.current = null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được tin nhắn cũ.');
    } finally {
      setLoadingOlder(false);
    }
  }

  // ─── Send ───────────────────────────────────────────────────────
  async function send() {
    const text = draft.trim();
    if ((!text && !pendingImage) || sending) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/staff/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          text,
          imageDataUrl: pendingImage,
          replyToId: replyTo?.id ?? null,
        }),
      });
      const data = (await res.json()) as { message?: ChatMessage; error?: string };
      if (!res.ok || !data.message) {
        throw new Error(data.error || 'Không gửi được tin nhắn.');
      }
      // The SSE frame usually gets here first; upserting on the response means
      // the sender sees their own message even with SSE down.
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message!.id)) return prev;
        const next = [...prev, data.message!].slice(-MAX_LOADED_MESSAGES);
        messagesRef.current = next;
        return next;
      });
      if (messagesRef.current.length >= MAX_LOADED_MESSAGES) setHasOlderMessages(true);
      setDraft('');
      setPendingImage(null);
      setReplyTo(null);
      atBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không gửi được tin nhắn.');
    } finally {
      setSending(false);
    }
  }

  async function pickImage(file: File) {
    setError(null);
    setCompressing(true);
    try {
      const dataUrl = await compressImage(file);
      if (!dataUrl) {
        setError('Ảnh quá lớn hoặc không đọc được. Vui lòng chọn ảnh nhỏ hơn 8 MB.');
        return;
      }
      setPendingImage(dataUrl);
    } catch {
      setError('Không xử lý được ảnh này.');
    } finally {
      setCompressing(false);
    }
  }

  // ─── React / recall ─────────────────────────────────────────────
  async function toggleReaction(message: ChatMessage, emoji: string) {
    setEmojiFor(null);
    // Optimistic: the bubble must feel instant, and the SSE frame corrects it.
    const optimistic: ChatMessage = {
      ...message,
      reactions: applyOptimisticReaction(message.reactions, emoji, staff.id),
    };
    setMessages((prev) => {
      const next = prev.map((m) => (m.id === message.id ? optimistic : m));
      messagesRef.current = next;
      return next;
    });

    try {
      const res = await fetch(`/api/staff/chat/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'react', emoji }),
      });
      const data = (await res.json()) as { message?: ChatMessage };
      if (!res.ok || !data.message) return; // the SSE frame or the next poll fixes it
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === message.id ? data.message! : m));
        messagesRef.current = next;
        return next;
      });
    } catch {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === message.id ? message : m));
        messagesRef.current = next;
        return next;
      });
    }
  }

  async function recall(message: ChatMessage) {
    if (!window.confirm('Thu hồi tin nhắn này? Nội dung sẽ bị xoá vĩnh viễn.')) return;
    setMessages((prev) => {
      const next = prev.map((m) => (m.id === message.id ? { ...m, recalled: true } : m));
      messagesRef.current = next;
      return next;
    });
    try {
      await fetch(`/api/staff/chat/${message.id}`, { method: 'DELETE' });
    } catch {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === message.id ? message : m));
        messagesRef.current = next;
        return next;
      });
    }
  }

  const groups = groupByDay(messages);

  return (
    <div className="relative flex h-[calc(100dvh-70px)] min-h-[420px] flex-col overflow-hidden bg-gradient-to-b from-[#070b16] via-[#0b1322] to-[#0d1526]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-liquid-mesh" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-4xl flex-1 flex-col px-3 pb-4 pt-6 sm:px-6">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white">
              Chatbox Nội Bộ
              <span
                title={connected ? 'Đang kết nối realtime' : 'Đang dùng chế độ dự phòng (polling)'}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  connected
                    ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300'
                    : 'border-amber-300/25 bg-amber-400/10 text-amber-300'
                )}
              >
                {connected ? <Wifi className="size-2.5" /> : <WifiOff className="size-2.5" />}
                {connected ? 'Trực tiếp' : 'Dự phòng'}
              </span>
            </h1>
            <p className="mt-0.5 text-xs text-white/45">
              Kênh liên lạc nội bộ · không dùng để trao đổi dữ liệu khách hàng
            </p>
          </div>

          <div className="flex gap-2">
            {channels.map((name) => {
              const active = name === channel;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setChannel(name)}
                  className={cn(
                    'rounded-full border px-3.5 py-2 text-xs font-bold transition-colors',
                    active
                      ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-200'
                      : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10'
                  )}
                >
                  {name === STAFF_CHAT_CHANNEL ? 'Tất cả nhân viên' : `Chi nhánh ${staff.branchCode}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Message list */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain rounded-[26px] border border-white/12 bg-white/[0.04] p-3 backdrop-blur-2xl sm:p-4"
          role="log"
          aria-live="polite"
          aria-label="Tin nhắn nội bộ"
        >
          {hasOlderMessages && (
            <div className="sticky top-0 z-20 flex justify-center py-1">
              <button
                type="button"
                onClick={() => void loadOlderMessages()}
                disabled={loadingOlder}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-[#0b1120]/90 px-3.5 py-2 text-[11px] font-bold text-white/65 shadow-lg backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                {loadingOlder && <Loader2 className="size-3.5 animate-spin" />}
                {loadingOlder ? 'Đang tải tin cũ…' : 'Tải tin nhắn cũ hơn'}
              </button>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 text-center">
              <MessageSquare className="size-8 text-white/20" />
              <p className="text-sm font-bold text-white/60">Chưa có tin nhắn nào</p>
              <p className="max-w-xs text-xs text-white/35">
                Hãy bắt đầu cuộc trò chuyện — mọi nội dung ở đây chỉ dành cho nhân viên Belwee.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.day}>
                <div className="sticky top-0 z-10 my-2 flex justify-center">
                  <span className="rounded-full border border-white/12 bg-[#0b1120]/85 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white/50 backdrop-blur-xl">
                    {group.day}
                  </span>
                </div>

                {group.items.map((message) => {
                  const mine = message.staffId === staff.id;
                  return (
                    <motion.div
                      key={message.id}
                      layout="position"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn('group relative mb-2 flex gap-2', mine ? 'flex-row-reverse' : '')}
                    >
                      {/* Avatar */}
                      {!mine &&
                        (message.staffAvatarUrl ? (
                          <span className="relative size-8 shrink-0 overflow-hidden rounded-full border border-white/15">
                            <Image
                              src={message.staffAvatarUrl}
                              alt=""
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                          </span>
                        ) : (
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8 text-[10px] font-extrabold text-white/70">
                            {message.staffName.slice(0, 1).toUpperCase()}
                          </span>
                        ))}

                      <div className={cn('min-w-0 max-w-[78%]', mine ? 'items-end' : '')}>
                        {/* Reply preview */}
                        {message.replyToId && (
                          <div
                            className={cn(
                              'mb-1 rounded-lg border-l-2 border-amber-300/60 bg-white/[0.05] px-2.5 py-1.5 text-[11px]',
                              mine ? 'ml-auto' : ''
                            )}
                          >
                            <span className="font-bold text-amber-200/80">
                              {message.replyToName ?? 'Tin nhắn'}
                            </span>
                            <span className="ml-1.5 text-white/50">
                              {message.replyToPreview ?? '(đã bị thu hồi)'}
                            </span>
                          </div>
                        )}

                        <div
                          className={cn(
                            'relative rounded-2xl px-3.5 py-2.5 backdrop-blur-xl',
                            mine
                              ? 'rounded-br-md border border-emerald-300/25 bg-emerald-400/15'
                              : 'rounded-bl-md border border-white/12 bg-white/[0.07]'
                          )}
                        >
                          {!mine && (
                            <p className="mb-1 text-[11px] font-bold text-emerald-300">
                              {message.staffName}
                            </p>
                          )}

                          {message.recalled ? (
                            <p className="text-xs italic text-white/40">
                              Tin nhắn đã được thu hồi
                            </p>
                          ) : (
                            <>
                              {message.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => setLightbox(message)}
                                  className="mb-2 block overflow-hidden rounded-xl border border-white/12"
                                >
                                  {/* A user-supplied data URL cannot go through
                                      next/image (it is not a static import and
                                      would need a loader that base64-decodes),
                                      so this is a plain <img> by necessity. */}
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={message.imageUrl}
                                    alt="Ảnh đính kèm"
                                    loading="lazy"
                                    decoding="async"
                                    className="max-h-64 w-full object-cover"
                                  />
                                </button>
                              )}
                              {message.text && (
                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/92">
                                  {message.text}
                                </p>
                              )}
                            </>
                          )}

                          <div
                            className={cn(
                              'mt-1 flex items-center gap-2 text-[10px] text-white/35',
                              mine ? 'justify-end' : ''
                            )}
                          >
                            <time dateTime={message.createdAt}>{timeOf(message.createdAt)}</time>
                            {message.recalled && message.recalledAt && (
                              <span>· thu hồi {timeOf(message.recalledAt)}</span>
                            )}
                          </div>
                        </div>

                        {/* Reactions + actions */}
                        {!message.recalled && (
                          <>
                            {message.reactions.length > 0 && (
                              <div className={cn('mt-1 flex flex-wrap gap-1', mine ? 'justify-end' : '')}>
                                {message.reactions.map((reaction: ChatReaction) => (
                                  <button
                                    key={reaction.emoji}
                                    type="button"
                                    onClick={() => void toggleReaction(message, reaction.emoji)}
                                    title={`${reaction.staffIds.length} người thích`}
                                    className={cn(
                                      'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-all hover:scale-105',
                                      reaction.staffIds.includes(staff.id)
                                        ? 'border-emerald-300/40 bg-emerald-400/20 text-white'
                                        : 'border-white/15 bg-white/[0.06] text-white/70'
                                    )}
                                  >
                                    <span>{reaction.emoji}</span>
                                    <span className="font-bold tabular-nums">
                                      {reaction.staffIds.length}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Hover actions — always in the DOM so keyboard focus
                                can reach them, revealed on focus as well as hover. */}
                            <div
                              className={cn(
                                'mt-1 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100',
                                mine ? 'justify-end' : ''
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => setReplyTo(message)}
                                aria-label="Trả lời"
                                className="rounded-full border border-white/12 bg-white/[0.06] p-1.5 text-white/50 transition-colors hover:bg-white/12 hover:text-white"
                              >
                                <Reply className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEmojiFor((current) => (current === message.id ? null : message.id))
                                }
                                aria-label="Thả biểu tượng cảm xúc"
                                className="rounded-full border border-white/12 bg-white/[0.06] p-1.5 text-white/50 transition-colors hover:bg-white/12 hover:text-white"
                              >
                                <Smile className="size-3" />
                              </button>
                              {mine && (
                                <button
                                  type="button"
                                  onClick={() => void recall(message)}
                                  aria-label="Thu hồi tin nhắn"
                                  className="rounded-full border border-red-300/20 bg-red-400/10 p-1.5 text-red-300/70 transition-colors hover:bg-red-400/25 hover:text-red-200"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              )}
                            </div>
                          </>
                        )}

                        {/* Emoji fly-out */}
                        <AnimatePresence>
                          {emojiFor === message.id && (
                            <motion.div
                              initial={{ opacity: 0, y: 8, scale: 0.85 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 6, scale: 0.9 }}
                              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                              className={cn(
                                'absolute bottom-full z-30 mb-1 flex gap-1 rounded-2xl border border-white/15 bg-[#0b1120]/95 p-1.5 shadow-spatial-depth backdrop-blur-2xl',
                                mine ? 'right-0' : 'left-0'
                              )}
                            >
                              {ALLOWED_REACTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => void toggleReaction(message, emoji)}
                                  className="flex size-8 items-center justify-center rounded-xl text-lg transition-transform hover:scale-125 hover:bg-white/10"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200"
          >
            {error}
          </p>
        )}

        {/* Composer */}
        <div className="mt-3 rounded-[26px] border border-white/12 bg-white/[0.06] p-3 backdrop-blur-2xl">
          <AnimatePresence>
            {replyTo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-2 flex items-start gap-2 overflow-hidden rounded-xl border-l-2 border-amber-300/60 bg-white/[0.05] px-3 py-2"
              >
                <CornerUpLeft className="mt-0.5 size-3.5 shrink-0 text-amber-200/80" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-amber-200/80">
                    Trả lời {replyTo.staffName}
                  </p>
                  <p className="truncate text-[11px] text-white/50">
                    {replyTo.recalled ? '(đã thu hồi)' : replyTo.text || '📷 Ảnh'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  aria-label="Bỏ trả lời"
                  className="shrink-0 text-white/40 transition-colors hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {pendingImage && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mb-2 flex items-center gap-3 rounded-xl border border-white/12 bg-white/[0.05] p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingImage}
                  alt="Ảnh sắp gửi"
                  className="size-14 rounded-lg object-cover"
                />
                <span className="flex-1 text-[11px] text-white/50">
                  Ảnh đã được nén còn ~{approximateKb(pendingImage)} KB
                </span>
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  aria-label="Bỏ ảnh"
                  className="shrink-0 rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void pickImage(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={compressing}
              aria-label="Đính kèm ảnh"
              title="Đính kèm ảnh (tự động nén)"
              className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06] text-white/60 transition-colors hover:bg-white/12 hover:text-white disabled:opacity-50"
            >
              {compressing ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4.5" />}
            </button>

            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter makes a new line. Guard against IME
                // composition — Enter there confirms a candidate, not the send.
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Nhập tin nhắn nội bộ…"
              aria-label="Nội dung tin nhắn"
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-sm text-white outline-none backdrop-blur-xl transition-colors placeholder:text-white/30 focus:border-emerald-300/50 focus:shadow-[0_0_0_4px_rgba(52,211,153,0.12)]"
            />

            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || (!draft.trim() && !pendingImage)}
              aria-label="Gửi tin nhắn"
              className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 transition-all hover:bg-emerald-300 active:scale-95 disabled:opacity-40"
            >
              {sending ? (
                <Loader2 className="size-4.5 animate-spin" />
              ) : (
                <SendHorizonal className="size-4.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Full-screen image viewer */}
      <AnimatePresence>
        {lightbox?.imageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Xem ảnh toàn màn hình"
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-md"
            onClick={() => setLightbox(null)}
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Đóng"
              className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="size-5" />
            </button>
            <motion.div
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full overflow-hidden rounded-2xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.imageUrl}
                alt="Ảnh đính kèm — xem toàn màn hình"
                className="max-h-[85vh] w-auto max-w-full object-contain"
              />
            </motion.div>
            <p className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-xs text-white/70 backdrop-blur-xl">
              <ZoomIn className="size-3.5" />
              {lightbox.staffName} · {timeOf(lightbox.createdAt)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
