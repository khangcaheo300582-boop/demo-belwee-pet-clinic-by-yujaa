"use client";

/**
 * app/booking/cham-soc-khach-hang/page.tsx
 * Trang chăm sóc khách hàng trực tuyến — Belwee International Animal Hospital.
 *
 * Thiết kế Liquid Glass: nền kính mờ, viền kính tinh tế, ánh sáng phản chiếu nhẹ,
 * đổ bóng mềm, chuyển động mượt và phân cấp thị giác rõ ràng.
 *
 * KHÔNG CÒN BÁC SĨ CỐ ĐỊNH
 *   Trước đây phiên chat luôn gắn "BS. Trần Minh Châu" bất kể ai đang online.
 *   Giờ đây, khi khách đồng ý điều khoản, trang này gọi /api/customer/care để
 *   hệ thống CHỌN MỘT nhân viên/bác sĩ ĐANG ONLINE (heartbeat lib/dbPresence)
 *   chào yêu cầu về đúng màn hình của người đó (kênh SSE staff:care).
 *   · Nhân viên TIẾP NHẬN  → phiên thành accepted, chat thật qua
 *     /api/customer/chat (đã lưu trong data/chat.json).
 *   · Nhân viên LOẠI BỎ    → hệ thống chào người online kế tiếp.
 *   · Hết người online     → phiên thành busy, khách nhìn thấy câu
 *     "Các bác sĩ đều bận, bạn liên hệ sau nhé! Belwee cảm ơn."
 */

import { useState, useCallback, useEffect, useRef, useMemo, useReducer } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Wifi,
  WifiOff,
  Clock,
  X,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Stethoscope,
  Paperclip,
  RotateCcw,
} from "lucide-react";
import GlassToast from "@/components/GlassToast";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/imageCompress";
import type { ChatMessage } from "@/lib/chatShared";

/* ─── Các trạng thái phiên ───────────────────────────────────────────── */
const SESSION_KEY = "belwee-customer-session-v1";

type SessionPhase = "welcome" | "connecting" | "active" | "ending" | "ended" | "busy";

const BUSY_MESSAGE = "Các bác sĩ đều bận, bạn liên hệ sau nhé! Belwee cảm ơn.";

/* ─── Type tin nhắn (khớp cấu trúc lib/dbChat) ───────────────────────── */
interface ChatBubble {
  id: string;
  text: string;
  imageUrl?: string | null;
  sender: "customer" | "doctor";
  senderName: string;
  createdAt: string;
  status: "sending" | "sent" | "failed";
}

interface DoctorInfo {
  name: string;
  avatarUrl: string | null;
  title: string;
}

/**
 * Chuyển một dòng dữ liệu chat của server thành bong bóng hiển thị.
 * `recalled` bị bỏ: tin đã thu hồi không hiện cho khách.
 */
function toBubble(row: ChatMessage): ChatBubble | null {
  if (row.recalled) return null;
  return {
    id: row.id,
    text: row.text,
    imageUrl: row.imageUrl ?? null,
    sender: row.staffId === "CUSTOMER" ? "customer" : "doctor",
    senderName: row.staffName,
    createdAt: row.createdAt,
    status: "sent",
  };
}

/* ─── Component chính ───────────────────────────────────────────────────── */
export default function CustomerCarePage() {

  /* ─── State ──────────────────────────────────────────────────────────── */
  const [phase, setPhase] = useState<SessionPhase>("welcome");
  const [termsAgreed, setTermsAgreed] = useState({ service: false, user: false });
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null);
  const [autoEndRemaining, setAutoEndRemaining] = useState(0);
  /** Nhân viên/bác sĩ đang gõ — cập nhật từ mỗi nhịp poll /api/customer/chat. */
  const [staffTyping, setStaffTyping] = useState(false);
  /**
   * Timers của bộ đếm tự kết thúc sống trong REF, không phải state.
   *
   * Bản cũ lưu timeout trong state VÀ dùng nó làm dependency của effect khởi
   * động bộ đếm — mỗi lần chạy lại ghi state mới → identity callback đổi →
   * effect chạy lại vô hạn → React bắn "Maximum update depth exceeded" và BỎ
   * toàn bộ cập nhật state còn lại (tin nhắn poll về không bao giờ render được).
   */
  const autoEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoEndTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Nhịp "hoạt động mới" — mỗi lần khách gửi tin nhắn/tiếp tục, đếm lại 2 phút. */
  const [activityNonce, bumpActivity] = useReducer((n: number) => n + 1, 0);

  /** sessionId do MÁY CHỦ sinh — chìa khoá của phiên, mất là mất phiên. */
  const sessionRef = useRef<{ sessionId: string; customerName: string } | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const lastMessageAtRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Heartbeat + cờ "khách đang gõ" — tránh gửi trùng khi focus lặp lại. */
  const typingBeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingActiveRef = useRef(false);

  const persistSession = useCallback(
    (extra: Partial<{ phase: SessionPhase; doctorInfo: DoctorInfo | null; messages: ChatBubble[]; sessionId: string; customerName: string }>) => {
      try {
        const current = localStorage.getItem(SESSION_KEY);
        const parsed = current ? JSON.parse(current) : {};
        const updated = {
          ...parsed,
          ...extra,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      } catch {
        /* bỏ qua */
      }
    },
    []
  );

  /* ─── Đang nhập: khách → nhân viên ──────────────────────────────────── */
  const postTyping = useCallback((typing: boolean) => {
    const sessionId = sessionRef.current?.sessionId;
    if (!sessionId) return;
    void fetch("/api/customer/care/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, typing, role: "customer" }),
      keepalive: true,
    }).catch(() => {
      /* server tự hết hạn sau 8 giây — nhịp heartbeat sẽ thử lại */
    });
  }, []);

  const stopCustomerTyping = useCallback(() => {
    if (typingBeatRef.current) {
      clearInterval(typingBeatRef.current);
      typingBeatRef.current = null;
    }
    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      postTyping(false);
    }
  }, [postTyping]);

  const startCustomerTyping = useCallback(() => {
    if (typingActiveRef.current) return;
    typingActiveRef.current = true;
    postTyping(true);
    // Làm mới trước TTL 8 giây để chỉ báo không chớp khi khách gõ lâu.
    typingBeatRef.current = setInterval(() => postTyping(true), 4_000);
  }, [postTyping]);

  // Rời màn chat hoặc unmount khi ô soạn đang focus: tắt chỉ báo ngay.
  useEffect(() => {
    if (phase === "active") return;
    setStaffTyping(false);
    stopCustomerTyping();
  }, [phase, stopCustomerTyping]);

  useEffect(() => () => stopCustomerTyping(), [stopCustomerTyping]);

  /* ─── Hợp nhất tin nhắn theo id (poll + optimistic cùng nhau sống) ───── */
  const mergeMessages = useCallback((incoming: ChatBubble[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const next = [...prev];
      for (const bubble of incoming) {
        if (knownIdsRef.current.has(bubble.id)) continue;
        knownIdsRef.current.add(bubble.id);
        next.push(bubble);
      }
      next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return next;
    });
    const newest = [...incoming].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (newest) lastMessageAtRef.current = newest.createdAt;
  }, []);

  /* ─── Khôi phục phiên khi tải lại trang ─────────────────────────────── */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const saved = localStorage.getItem(SESSION_KEY);
        if (!saved) return;
        const data = JSON.parse(saved) as {
          sessionId?: string;
          customerName?: string;
          doctorInfo?: DoctorInfo | null;
          messages?: ChatBubble[];
        };
        // Bản cũ (thời mock) không có sessionId — bỏ qua, về welcome.
        if (!data?.sessionId) {
          localStorage.removeItem(SESSION_KEY);
          return;
        }
        sessionRef.current = {
          sessionId: data.sessionId,
          customerName: data.customerName ?? "Khách hàng",
        };
        if (Array.isArray(data.messages)) {
          for (const bubble of data.messages) knownIdsRef.current.add(bubble.id);
          setMessages(data.messages);
        }
        const res = await fetch(`/api/customer/care?sessionId=${encodeURIComponent(data.sessionId)}`, {
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as
          | { status?: string; customerName?: string; staff?: { name?: string; avatarUrl?: string | null; jobTitle?: string | null } | null }
          | null;
        if (!alive) return;
        if (!res.ok || !payload) {
          localStorage.removeItem(SESSION_KEY);
          sessionRef.current = null;
          return;
        }
        if (payload.customerName) {
          sessionRef.current = { sessionId: data.sessionId, customerName: payload.customerName };
        }
        if (payload.status === "accepted" && payload.staff?.name) {
          const info: DoctorInfo = {
            name: payload.staff.name,
            avatarUrl: payload.staff.avatarUrl ?? null,
            title: payload.staff.jobTitle ?? "Nhân viên tư vấn",
          };
          setDoctorInfo(info);
          setMessages((prev) => prev);
          setPhase("active");
          setConnected(true);
        } else if (payload.status === "waiting") {
          setPhase("connecting");
        } else {
          // busy / closed
          if (payload.status === "busy") {
            setPhase("busy");
            persistSession({ phase: "busy" });
          } else {
            localStorage.removeItem(SESSION_KEY);
            sessionRef.current = null;
          }
        }
      } catch {
        /* bỏ qua lỗi parse */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Tạo yêu cầu sau khi đồng ý điều khoản ─────────────────────────── */
  const startChat = useCallback(async () => {
    if (!(termsAgreed.service && termsAgreed.user)) return;
    setPhase("connecting");
    try {
      const res = await fetch("/api/customer/care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await res.json().catch(() => null)) as
        | { sessionId?: string; customerName?: string; status?: string; error?: string }
        | null;
      if (!res.ok || !payload?.sessionId) {
        throw new Error(payload?.error || "Không tạo được yêu cầu.");
      }
      sessionRef.current = {
        sessionId: payload.sessionId,
        customerName: payload.customerName ?? "Khách hàng",
      };
      persistSession({
        sessionId: payload.sessionId,
        customerName: payload.customerName,
        phase: "connecting",
        doctorInfo: null,
        messages: [],
      });
      if (payload.status === "busy") {
        setPhase("busy");
        persistSession({ phase: "busy" });
      }
    } catch (e) {
      setToast({
        msg: e instanceof Error ? e.message : "Không kết nối được máy chủ.",
        tone: "error",
      });
      setPhase("welcome");
    }
  }, [termsAgreed, persistSession]);

  /* ─── Poll trạng thái khi đang chờ sẵn ──────────────────────────────── */
  useEffect(() => {
    if (phase !== "connecting") return;
    let alive = true;

    const tick = async () => {
      const sessionId = sessionRef.current?.sessionId;
      if (!sessionId || !alive) return;
      try {
        const res = await fetch(`/api/customer/care?sessionId=${encodeURIComponent(sessionId)}`, {
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as
          | { status?: string; staff?: { name?: string; avatarUrl?: string | null; jobTitle?: string | null } | null }
          | null;
        if (!alive || !res.ok || !payload) return;

        if (payload.status === "accepted" && payload.staff?.name) {
          const info: DoctorInfo = {
            name: payload.staff.name,
            avatarUrl: payload.staff.avatarUrl ?? null,
            title: payload.staff.jobTitle ?? "Nhân viên tư vấn",
          };
          setDoctorInfo(info);
          setPhase("active");
          setConnected(true);
          persistSession({ phase: "active", doctorInfo: info });
          const welcomeMsg: ChatBubble = {
            id: `MSG_WELCOME_${Date.now()}`,
            text: `Chào bạn, mình là ${info.name} của Belwee International Animal Hospital. Bạn mô tả thêm biểu hiện của bé để mình hỗ trợ nhé.`,
            sender: "doctor",
            senderName: `BS/NV ${info.name}`,
            createdAt: new Date().toISOString(),
            status: "sent",
          };
          mergeMessages([welcomeMsg]);
          lastMessageAtRef.current = null; // lịch sử thật sẽ được poll bằng approvedmsg riêng
        } else if (payload.status === "busy") {
          setPhase("busy");
          persistSession({ phase: "busy" });
        }
        // 'waiting' → giữ nguyên connecting
      } catch {
        /* nhịp sau thử lại */
      }
    };

    const intervalId = setInterval(() => void tick(), 2500);
    void tick();
    return () => {
      alive = false;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ─── Poll tin nhắn khi đang chat thật ──────────────────────────────── */
  useEffect(() => {
    if (phase !== "active") return;
    let alive = true;

    const tick = async () => {
      const sessionId = sessionRef.current?.sessionId;
      if (!sessionId || !alive) return;
      // Lần một gọi chậm nhất → GET full history; các lần sau → chỉ tin mới.
      const base = `/api/customer/chat?sessionId=${encodeURIComponent(sessionId)}`;
      const since = lastMessageAtRef.current ? `&since=${encodeURIComponent(lastMessageAtRef.current)}` : "";
      try {
        const res = await fetch(`${base}${since}`, { cache: "no-store" });
        const payload = (await res.json().catch(() => null)) as {
          messages?: ChatMessage[];
          staffTyping?: boolean;
        } | null;
        if (!alive || !res.ok || !payload?.messages) return;
        const bubbles = payload.messages
          .map(toBubble)
          .filter((bubble): bubble is ChatBubble => bubble !== null);
        mergeMessages(bubbles);
        // Chỉ báo đang nhập của nhân viên đi kèm mỗi nhịp poll 3 giây.
        setStaffTyping(payload.staffTyping === true);
      } catch {
        /* nhịp sau thử lại */
      }
    };

    const intervalId = setInterval(() => void tick(), 3000);
    void tick();
    return () => {
      alive = false;
      clearInterval(intervalId);
      setStaffTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ─── Lưu phiên mỗi khi tin nhắn đổi ────────────────────────────────── */
  useEffect(() => {
    if (!sessionRef.current) return;
    persistSession({ phase, messages: messages.slice(-30) });
  }, [phase, messages, persistSession]);

  /* ─── Bộ đếm ngắt kết nối tự động (2 phút không hoạt động + gia hạn) ── */
  /**
   * Dọn dẹp timers — không đụng state ⇒ callback ổn định, không bao giờ tự
   * kích hoạt lại chính effect gọi nó.
   */
  const clearInactivity = useCallback(() => {
    if (autoEndTimeoutRef.current) {
      clearTimeout(autoEndTimeoutRef.current);
      autoEndTimeoutRef.current = null;
    }
    if (autoEndTickRef.current) {
      clearInterval(autoEndTickRef.current);
      autoEndTickRef.current = null;
    }
    setAutoEndRemaining(0);
  }, []);

  /**
   * Kết thúc dứt khoát: chuyển 'ended' — dùng ở cả tự đếm hết lẫn "Ngắt kết nối".
   */
  const settleEnded = useCallback(() => {
    clearInactivity();
    setPhase("ended");
    setConnected(false);
    persistSession({ phase: "ended" });
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionRef.current = null;
    } catch {
      /* bỏ qua lỗi localStorage */
    }
  }, [clearInactivity, persistSession]);

  useEffect(() => {
    clearInactivity();
    if (phase === "active") {
      // 2 phút im lặng ⇒ đưa về màn "ending"; bản thân 'ending' tự đếm 15 giây.
      autoEndTimeoutRef.current = setTimeout(() => {
        autoEndTimeoutRef.current = null;
        setPhase("ending");
        persistSession({ phase: "ending" });
      }, 120_000);
    } else if (phase === "ending") {
      // Đồng hồ 15 giây cho quyết định: tiếp tục hay kết thúc.
      let remaining = 15;
      setAutoEndRemaining(remaining);
      autoEndTickRef.current = setInterval(() => {
        remaining -= 1;
        setAutoEndRemaining(remaining <= 0 ? 0 : remaining);
        if (remaining <= 0 && autoEndTickRef.current) {
          clearInterval(autoEndTickRef.current);
          autoEndTickRef.current = null;
          settleEnded();
        }
      }, 1000);
    }
    return clearInactivity;
  }, [phase, activityNonce, clearInactivity, settleEnded, persistSession]);

  /* ─── Cuộn tự động ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (messagesEndRef.current && (messages.length > 0 || staffTyping)) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, staffTyping]);

  /* ─── Gửi tin nhắn (thật) ───────────────────────────────────────────── */
  const handleSend = useCallback(async () => {
    if (phase !== "active") return;
    const text = draft.trim();
    if (!text && !pendingImage) return;
    if (pendingImage && !text) {
      setToast({ msg: "Hãy viết một mô tả ngắn cho ảnh của bé.", tone: "error" });
      return;
    }
    setSending(true);

    const tempId = `MSG_TMP_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const optimistic: ChatBubble = {
      id: tempId,
      text,
      imageUrl: pendingImage,
      sender: "customer",
      senderName: "Bạn",
      createdAt: new Date().toISOString(),
      status: "sending",
    };
    mergeMessages([optimistic]);
    const image = pendingImage;
    setDraft("");
    setPendingImage(null);

    try {
      const sessionId = sessionRef.current?.sessionId;
      if (!sessionId) throw new Error("Phiên đã hết.");
      const res = await fetch("/api/customer/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, text, imageDataUrl: image }),
      });
      const payload = (await res.json().catch(() => null)) as { message?: ChatMessage; error?: string } | null;
      if (!res.ok || !payload?.message) {
        throw new Error(payload?.error || "Không thể gửi tin nhắn.");
      }
      const bubble = toBubble(payload.message);
      setSending(false);
      bumpActivity(); // hoạt động mới ⇒ 2 phút im lặng bắt đầu lại
      if (bubble) {
        // Thay optimistic bằng hàng thật (id server) — optimistic bị loại.
        knownIdsRef.current.add(tempId); // tránh poll tái thêm
        setMessages((prev) => prev.map((m) => (m.id === tempId ? bubble : m)));
      }
    } catch {
      setSending(false);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" as const } : m)));
      setToast({ msg: "Không gửi được tin nhắn. Thử lại nhé.", tone: "error" });
    }
  }, [draft, pendingImage, phase, mergeMessages, bumpActivity]);

  /* ─── Xử lý đính kèm (ảnh, nén ở máy khách) ─────────────────────────── */
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCompressing(true);
    const dataUrl = await compressImage(file);
    setCompressing(false);
    if (!dataUrl) {
      setToast({ msg: "Ảnh không đọc được hoặc quá lớn (tối đa ~1,2MB sau nén).", tone: "error" });
      return;
    }
    setPendingImage(dataUrl);
  }, []);

  /* ─── Nút bắt đầu trò chuyện ─────────────────────────────────────────── */
  const canStart = termsAgreed.service && termsAgreed.user;

  /* ─── Nút ngắt kết nối ───────────────────────────────────────────────── */
  const handleEndConnection = () => {
    settleEnded();
    window.location.href = "/";
  };

  const handleContinueChat = () => {
    setPhase("active"); // từ màn 'ending' quay lại chat; effect tự đếm lại 2 phút
    bumpActivity();
  };

  /** Từ trạng thái busy: thử lại với Một phiên mới (đội ngũ sẽ chào lại). */
  const retryRequest = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionRef.current = null;
      knownIdsRef.current = new Set();
      lastMessageAtRef.current = null;
      setMessages([]);
      setDoctorInfo(null);
      setConnected(false);
    } catch {
      /* bỏ qua */
    }
    void startChat();
  }, [startChat]);

  /* ─── Mở nội dung điều khoản ────────────────────────────────────────── */
  const openTerms = (type: "service" | "user") => {
    // Trong thực tế điều hướng đến trang điều khoản hoặc hiển thị modal
    setToast({ msg: `Mở điều khoản ${type === "service" ? "dịch vụ" : "người dùng"} (cấu hình trong hệ thống)`, tone: "success" });
  };

  const statusLabel = useMemo(() => {
    if (phase === "connecting") return "Đang tìm nhân viên/bác sĩ online";
    if (phase === "active") return connected ? "Đang trò chuyện" : "Mất kết nối";
    if (phase === "ending") return "Đang kết thúc";
    if (phase === "ended") return "Đã kết thúc";
    if (phase === "busy") return "Đội ngũ đang bận";
    return "Chờ kết nối";
  }, [phase, connected]);

  /* ─── Render thẻ chào mừng ───────────────────────────────────────────── */
  if (phase === "welcome") {
    return (
      <div className="min-h-[calc(100dvh-70px)] bg-gradient-to-b from-[#0b1120] via-[#0d1526] to-[#070b16] relative overflow-hidden">
        {/* Nền kính lỏng */}
        <div className="absolute inset-0 bg-liquid-mesh pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b16]/60 via-transparent to-[#0b1120]/40 pointer-events-none" aria-hidden="true" />

        <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-70px)] max-w-xl items-start justify-center px-6 pt-32 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="my-auto w-full rounded-[32px] border border-white/[0.08] bg-white/[0.04] p-8 shadow-[0_32px_80px_-24px_rgba(2,6,23,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:p-10"
          >
            {/* Logo / biểu tượng */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/[0.08] bg-gradient-to-br from-emerald-400/10 to-blue-400/10 backdrop-blur-md shadow-[0_0_30px_-12px_rgba(34,197,94,0.25)]">
              <Stethoscope className="h-8 w-8 text-emerald-300 drop-shadow-[0_2px_4px_rgba(34,197,94,0.3)]" />
            </div>

            <h1 className="text-center text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Belwee xin chào!
            </h1>

            <div className="mt-5 space-y-4 text-[15px] leading-[1.75] text-white/80 text-center">
              <p>
                Chào mừng bạn đến với <span className="font-semibold text-emerald-200">Belwee International Animal Hospital</span> — nơi chúng tôi luôn đồng hành cùng bạn trong hành trình chăm sóc sức khỏe thú cưng.
              </p>
              <p>
                Bạn đang lo lắng về tình trạng sức khỏe của bé? Hãy chia sẻ với Belwee những dấu hiệu bất thường mà bé đang gặp phải. Đội ngũ của chúng tôi sẽ tiếp nhận thông tin, hỗ trợ đánh giá tình trạng ban đầu, giải đáp các thắc mắc và hướng dẫn bạn lựa chọn bước chăm sóc phù hợp.
              </p>
              <p className="text-[12px] text-white/45 italic">
                “Trao đổi trực tuyến hỗ trợ đánh giá ban đầu và không thay thế cho việc thăm khám trực tiếp khi cần thiết.”
              </p>
            </div>

            {/* Checkbox điều khoản */}
            <div className="mt-8 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={termsAgreed.service}
                  onChange={() => setTermsAgreed((p) => ({ ...p, service: !p.service }))}
                  className="mt-0.5 size-5 shrink-0 rounded-md border-white/20 bg-white/5 text-emerald-400 accent-emerald-400 focus:ring-emerald-400/30 transition-colors"
                />
                <span className="text-[13px] text-white/70 leading-relaxed select-none group-hover:text-white/90 transition-colors">
                  Tôi đã đọc và đồng ý với{" "}
                  <button
                    type="button"
                    onClick={() => openTerms("service")}
                    className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200 transition-colors font-medium"
                  >
                    Điều khoản dịch vụ
                  </button>
                  .
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={termsAgreed.user}
                  onChange={() => setTermsAgreed((p) => ({ ...p, user: !p.user }))}
                  className="mt-0.5 size-5 shrink-0 rounded-md border-white/20 bg-white/5 text-emerald-400 accent-emerald-400 focus:ring-emerald-400/30 transition-colors"
                />
                <span className="text-[13px] text-white/70 leading-relaxed select-none group-hover:text-white/90 transition-colors">
                  Tôi đã đọc và đồng ý với{" "}
                  <button
                    type="button"
                    onClick={() => openTerms("user")}
                    className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200 transition-colors font-medium"
                  >
                    Điều khoản người dùng
                  </button>
                  .
                </span>
              </label>
            </div>

            {/* Nút bắt đầu */}
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => void startChat()}
                disabled={!canStart}
                className={cn(
                  "relative overflow-hidden rounded-[20px] px-8 py-3.5 text-sm font-bold tracking-wide transition-all duration-300 shadow-lg",
                  "flex items-center gap-2.5",
                  canStart
                    ? "bg-gradient-to-r from-emerald-400 to-emerald-500 text-slate-950 hover:brightness-110 hover:shadow-[0_8px_32px_rgba(34,197,94,0.35)] active:scale-[0.98]"
                    : "bg-white/[0.06] text-white/30 border border-white/[0.08] cursor-not-allowed"
                )}
              >
                <span className="relative z-10">Đồng ý và bắt đầu trò chuyện</span>
                {canStart && (
                  <motion.span
                    initial={{ x: -4, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="relative z-10"
                  >
                    <ChevronRight className="size-4" />
                  </motion.span>
                )}
              </button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  /* ─── Render giao diện chat ─────────────────────────────────────────── */
  return (
    /*
     * Khung chat cao ĐÚNG bằng viewport và là flex column: chỉ danh sách tin
     * nhắn cuộn bên trong. Trước đây khung chỉ có `min-h` (không phải flex),
     * nên `flex-1` trên <main> vô tác dụng, danh sách cao theo nội dung và
     * `scrollIntoView` cuộn CẢ TRANG xuống ⇒ header chui xuống dưới thanh
     * điều hướng fixed và nội dung bị che.
     */
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-gradient-to-b from-[#070b16] via-[#0b1120] to-[#0d1526]">
      {/* Nền */}
      <div className="absolute inset-0 bg-liquid-mesh pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#070b16]/70 via-[#0b1120]/30 to-transparent pointer-events-none" aria-hidden="true" />

      {/* Header chat — pt-32: cùng khoảng chừa với các trang nền tối khác
          (dich-vu, gioi-thieu, lien-he…) để thanh điều hướng fixed không đè. */}
      <header className="relative z-20 mx-auto w-full max-w-3xl shrink-0 px-4 pt-32 pb-2 sm:px-6">
        <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.04] px-5 py-4 shadow-[0_24px_60px_-16px_rgba(2,6,23,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-emerald-400/15 to-blue-400/15 border border-white/[0.08] shadow-[0_0_16px_-6px_rgba(34,197,94,0.2)]">
              <Sparkles className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-[15px] font-extrabold tracking-tight text-white">Chăm sóc khách hàng trực tuyến</h2>
              <p className="text-[11px] text-white/40">Belwee International Animal Hospital</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm",
                phase === "busy"
                  ? "border-amber-300/25 bg-amber-400/10 text-amber-300"
                  : connected
                    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-300"
                    : "border-sky-300/25 bg-sky-400/10 text-sky-300"
              )}
            >
              {phase === "busy" || phase === "ended" ? <WifiOff className="size-2.5" /> : <Wifi className="size-2.5" />}
              {statusLabel}
            </span>

            {doctorInfo && (
              <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] pl-1 pr-3 py-0.5 backdrop-blur-md">
                <span className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-300/30 to-blue-300/30 border border-white/10 flex items-center justify-center text-[10px] font-extrabold text-emerald-200 shadow-[0_0_10px_-4px_rgba(34,197,94,0.3)]">
                  {doctorInfo.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-[11px] font-medium text-white/80 truncate max-w-[120px]">{doctorInfo.name}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Khu vực tin nhắn */}
      <main className="relative z-10 mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col px-4 sm:px-6">
        <div
          ref={listRef}
          className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-[24px] bg-gradient-to-b from-white/[0.03] to-transparent px-3 py-4 scroll-smooth sm:px-4"
        >
          {/* Tin nhắn hệ thống */}
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-gradient-to-r from-emerald-400/15 to-blue-400/15 border border-white/[0.08] px-4 py-1.5 shadow-[0_0_20px_-8px_rgba(34,197,94,0.15)] backdrop-blur-xl">
              <p className="text-[11px] font-medium text-emerald-200/90 tracking-wide">Belwee xin chào, bạn vui lòng đợi chút nhé, chúng tôi sẽ kết nối với nhân viên/bác sĩ đang online.</p>
            </div>
          </div>

          {/* Loading 3 dấu chấm */}
          {phase === "connecting" && (
            <div className="flex items-center gap-3 mb-4 pl-2">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
                    className="block size-[6px] rounded-full bg-emerald-300/80 shadow-[0_0_6px_rgba(34,197,94,0.35)]"
                  />
                ))}
              </div>
              <span className="text-[11px] text-white/30">Đang tìm nhân viên/bác sĩ phù hợp...</span>
            </div>
          )}

          {phase === "connecting" && (
            <div className="flex justify-start mb-2">
              <div className="rounded-[18px] rounded-bl-md bg-gradient-to-br from-white/[0.06] to-white/[0.03] border border-white/[0.08] px-4 py-2.5 shadow-[0_2px_12px_rgba(2,6,23,0.25)] backdrop-blur-xl max-w-[88%]">
                <p className="text-[13px] text-white/70 leading-relaxed">Chúng tôi đang kiểm tra các bác sĩ trực tuyến. Xin bạn vui lòng đợi trong giây lát.</p>
              </div>
            </div>
          )}

          {/* Thông báo bận — đúng nội dung yêu cầu */}
          {phase === "busy" && (
            <div className="flex justify-start mb-4">
              <div className="flex gap-2.5 items-start max-w-[92%]">
                <span className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-300/20 to-amber-400/10 border border-white/10 flex items-center justify-center shrink-0 shadow-[0_0_12px_-4px_rgba(251,191,36,0.3)]">
                  <WifiOff className="h-4 w-4 text-amber-200" />
                </span>
                <div className="rounded-[20px] rounded-bl-md bg-gradient-to-br from-amber-400/[0.10] to-amber-500/[0.06] border border-amber-300/20 px-4 py-3 shadow-[0_4px_16px_rgba(251,191,36,0.12)] backdrop-blur-xl">
                  <p className="text-[11px] font-extrabold text-amber-200 mb-1 tracking-wide">BELWEE CUSTOMER CARE</p>
                  <p className="text-[13.5px] text-amber-50/90 leading-relaxed font-medium">{BUSY_MESSAGE}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tin nhắn xác nhận kết nối */}
          {phase === "active" && doctorInfo && messages.length === 0 && (
            <div className="flex justify-start mb-2">
              <div className="flex gap-2.5 items-start max-w-[92%]">
                <span className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-300/20 to-blue-300/20 border border-white/10 flex items-center justify-center shrink-0 shadow-[0_0_12px_-4px_rgba(34,197,94,0.3)]">
                  <Stethoscope className="h-4 w-4 text-emerald-200" />
                </span>
                <div className="rounded-[20px] rounded-bl-md bg-gradient-to-br from-white/[0.07] to-white/[0.03] border border-white/[0.1] px-4 py-3 shadow-[0_4px_16px_rgba(2,6,23,0.2)] backdrop-blur-xl">
                  <p className="text-[11px] font-extrabold text-emerald-200 mb-1">Nhân viên/bác sĩ {doctorInfo.name}</p>
                  <p className="text-[13px] text-white/75 leading-relaxed">Đã kết nối — bạn sẽ được {doctorInfo.name} hỗ trợ và giải đáp thắc mắc.</p>
                </div>
              </div>
            </div>
          )}

          {/* Tin nhắn */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex mb-3 gap-2.5",
                msg.sender === "customer" ? "flex-row-reverse" : "flex-row"
              )}
            >
              {msg.sender === "doctor" && (
                <span className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-300/20 to-blue-300/20 border border-white/10 flex items-center justify-center shrink-0 shadow-[0_0_12px_-4px_rgba(34,197,94,0.3)]">
                  <Stethoscope className="h-4 w-4 text-emerald-200" />
                </span>
              )}
              <div
                className={cn(
                  "rounded-[20px] px-4 py-3 shadow-sm backdrop-blur-xl border max-w-[82%]",
                  msg.sender === "customer"
                    ? "rounded-br-md bg-gradient-to-r from-blue-500/15 to-emerald-400/10 border-blue-300/15 text-white shadow-[0_2px_12px_rgba(59,130,246,0.12)]"
                    : "rounded-bl-md bg-gradient-to-br from-white/[0.06] to-white/[0.03] border-white/[0.1] text-white shadow-[0_2px_12px_rgba(2,6,23,0.25)]"
                )}
              >
                {msg.sender === "doctor" && (
                  <p className="text-[10px] font-extrabold text-emerald-200 mb-1 tracking-wide">{msg.senderName}</p>
                )}
                {msg.text && (
                  <p className="text-[13.5px] leading-[1.7] whitespace-pre-wrap break-words text-white/90">{msg.text}</p>
                )}
                {msg.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setLightbox(msg.imageUrl ?? null)}
                    className="mt-2 block w-full rounded-xl overflow-hidden border border-white/10 shadow-inner"
                    aria-label="Mở ảnh lớn"
                  >
                    <img src={msg.imageUrl} alt="Ảnh trong phiên chat" className="w-full max-h-72 object-cover" />
                  </button>
                )}
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-white/30">
                  <Clock className="h-2.5 w-2.5" />
                  <time dateTime={msg.createdAt}>{new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</time>
                  {msg.status === "sending" && <span className="ml-1 text-white/20">· đang gửi</span>}
                  {msg.status === "failed" && <span className="ml-1 text-red-300/70">· gửi thất bại</span>}
                </div>
              </div>
            </div>
          ))}

          {/* Nhân viên/bác sĩ đang nhập — hiện khi ô soạn của họ còn focus */}
          {phase === "active" && staffTyping && doctorInfo && (
            <div className="flex mb-3 gap-2.5 items-start">
              <span className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-300/20 to-blue-300/20 border border-white/10 flex items-center justify-center shrink-0 shadow-[0_0_12px_-4px_rgba(34,197,94,0.3)]">
                <Stethoscope className="h-4 w-4 text-emerald-200" />
              </span>
              <div className="rounded-[20px] rounded-bl-md bg-gradient-to-br from-white/[0.06] to-white/[0.03] border border-white/[0.1] px-4 py-3 shadow-[0_2px_12px_rgba(2,6,23,0.25)] backdrop-blur-xl">
                <p className="mb-1.5 text-[10px] font-extrabold text-emerald-200 tracking-wide">
                  {doctorInfo.name} đang nhập…
                </p>
                <span className="flex items-center gap-1.5" role="status" aria-label="Nhân viên đang nhập">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                      className="block size-[5px] rounded-full bg-emerald-300/80"
                    />
                  ))}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bộ đếm tự động kết thúc */}
        {phase === "ending" && (
          <div className="mx-auto max-w-md px-4 pb-3 pt-2">
            <div className="rounded-[20px] border border-amber-300/20 bg-gradient-to-r from-amber-400/8 to-amber-500/8 backdrop-blur-xl px-4 py-3 shadow-[0_2px_16px_rgba(251,191,36,0.1)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
                  <span className="text-[12px] font-medium text-amber-100">Nếu bạn không còn yêu cầu gì, Belwee sẽ hỗ trợ ngắt kết nối sau {autoEndRemaining} giây nữa.</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleContinueChat}
                    className="rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 px-4 py-1.5 text-[11px] font-bold text-slate-950 shadow-[0_2px_12px_rgba(34,197,94,0.25)] hover:brightness-110 transition"
                  >
                    Tiếp tục trò chuyện
                  </button>
                  <button
                    onClick={handleEndConnection}
                    className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-amber-400/20 transition"
                  >
                    Ngắt kết nối
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tin nhắn kết thúc */}
        {phase === "ended" && (
          <div className="mx-auto max-w-lg px-4 pb-6 pt-2">
            <div className="rounded-[20px] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent backdrop-blur-xl px-5 py-4 shadow-[0_4px_20px_rgba(2,6,23,0.2)]">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span className="text-sm font-extrabold text-emerald-200">Cuộc trò chuyện đã kết thúc</span>
              </div>
              <p className="text-[13px] text-white/60 leading-relaxed">
                Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của Belwee International Animal Hospital. Nếu cần thêm hỗ trợ, bạn có thể bắt đầu một cuộc trò chuyện mới bất kỳ lúc nào.
              </p>
            </div>
          </div>
        )}

        {/* Khu nhập tin nhắn (chỉ khi đang chat thật) */}
        {phase === "active" ? (
          <div className="sticky bottom-0 z-10 mx-auto w-full max-w-3xl shrink-0 px-4 pt-3 pb-4 sm:px-6">
            {messages.some((m) => m.status === "failed") && (
              <p className="mb-2 text-center text-[11px] font-medium text-red-300/80">
                Có tin nhắn chưa gửi được — kiểm tra kết nối và thử lại.
              </p>
            )}
            <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.04] px-4 py-3 shadow-[0_8px_32px_-8px_rgba(2,6,23,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl flex gap-2 items-end">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleFileSelect(e)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05] text-white/50 hover:text-white hover:bg-white/[0.1] transition backdrop-blur-md shadow-[0_0_8px_rgba(255,255,255,0.05)]"
                aria-label={compressing ? "Đang nén ảnh" : "Đính kèm ảnh"}
                title="Gửi ảnh tình trạng của bé"
              >
                {compressing ? (
                  <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white/80" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </button>

              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={startCustomerTyping}
                onBlur={stopCustomerTyping}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Mô tả biểu hiện của bé..."
                className="min-h-[44px] max-h-32 flex-1 resize-none rounded-2xl border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-white/25 focus:border-emerald-300/30 focus:bg-white/[0.08] transition-all backdrop-blur-xl shadow-inner"
              />

              <button
                onClick={() => void handleSend()}
                disabled={sending || (!draft.trim() && !pendingImage)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-slate-950 shadow-[0_2px_12px_rgba(34,197,94,0.25)] hover:brightness-110 transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Gửi tin nhắn"
              >
                {sending ? (
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Send className="h-4 w-4" />
                  </motion.span>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>

            {pendingImage && (
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 backdrop-blur-xl">
                <img src={pendingImage} alt="Ảnh sắp gửi" className="h-12 w-12 rounded-lg object-cover" />
                <span className="text-[11px] text-white/50">Ảnh đính kèm</span>
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
        ) : phase === "busy" ? (
          /* Bận: nút thử lại (yêu cầu phiên mới) + kết thúc */
          <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-3 pb-6 flex gap-2 justify-center">
            <button
              onClick={retryRequest}
              className="flex items-center gap-2 rounded-[20px] bg-gradient-to-r from-emerald-400 to-emerald-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-[0_2px_16px_rgba(34,197,94,0.2)] backdrop-blur-xl hover:brightness-110 transition"
            >
              <RotateCcw className="h-4 w-4" /> Thử lại với phiên mới
            </button>
            <button
              onClick={handleEndConnection}
              className="rounded-[20px] border border-white/[0.1] bg-white/[0.04] px-6 py-3.5 text-sm font-bold text-white/60 backdrop-blur-xl hover:bg-white/[0.08] transition"
            >
              Kết thúc
            </button>
          </div>
        ) : phase === "ended" ? (
          <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-3 pb-6">
            <button
              onClick={() => {
                setPhase("welcome");
                setTermsAgreed({ service: false, user: false });
                setDoctorInfo(null);
                setMessages([]);
                setDraft("");
                setPendingImage(null);
                setConnected(false);
                knownIdsRef.current = new Set();
                sessionRef.current = null;
                try {
                  localStorage.removeItem(SESSION_KEY);
                } catch {
                  /* bỏ qua */
                }
              }}
              className="w-full rounded-[20px] border border-white/[0.1] bg-gradient-to-r from-emerald-400/10 to-blue-400/10 px-6 py-3.5 text-sm font-bold text-emerald-200 hover:brightness-110 transition shadow-[0_2px_16px_rgba(34,197,94,0.1)] backdrop-blur-xl"
            >
              Bắt đầu cuộc trò chuyện mới
            </button>
          </div>
        ) : null}
      </main>

      {/* Lightbox ảnh */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-8"
            onClick={() => setLightbox(null)}
          >
            <div
              className="relative max-w-2xl max-h-[80vh] rounded-[24px] overflow-hidden border border-white/[0.15] shadow-[0_32px_80px_-24px_rgba(2,6,23,0.7)] backdrop-blur-2xl bg-gradient-to-b from-[#0b1120]/90 to-[#070b16]/90"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightbox(null)}
                className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition z-10"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
              <img src={lightbox} alt="Xem trước" className="max-h-[70vh] w-auto mx-auto rounded-[20px]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <GlassToast
        open={!!toast}
        message={toast?.msg ?? ""}
        tone={toast?.tone ?? "success"}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
