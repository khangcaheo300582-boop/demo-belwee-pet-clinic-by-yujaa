// app/api/customer/chat/route.ts
// API cho cuộc trò chuyện khách hàng — bác sĩ.
//
// KHÔNG yêu cầu xác thực khách hàng (trang công khai), nhưng mọi tin nhắn
// phải được lưu vào đúng phiên chăm sóc (lib/dbCare) và gắn với kênh
// `customer:<sessionId>` để nhân viên đã TIẾP NHẬN đọc được.
//
//   POST { sessionId, text, imageDataUrl? }  → lưu tin nhắn của khách
//   GET  ?sessionId=… &since=ISO?            → khách đọc lại luồng chat của mình
//
// Bảo mật: sessionId do MÁY CHỦ tự sinh (20 hex ngẫu nhiên) và là "chìa khoá"
// duy nhất khách cầm; ID đoán được sẽ gián tiếp lộ toàn bộ lịch sử, nên
// format bị chốt chặn ngay của một phiên hợp lệ.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbChat, type ChatMessage } from "@/lib/dbChat";
import { dbCare } from "@/lib/dbCare";
import { saveChatImage } from "@/lib/chatImages";
import { publish } from "@/lib/realtime";
import { STAFF_CARE_CHANNEL } from "@/lib/channels";
import { isTyping } from "@/lib/typingState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POST_SCHEMA = z.object({
  sessionId: z.string().min(8),
  text: z.string().max(2000).optional().default(""),
  imageDataUrl: z.string().nullable().optional(),
});

/** Only ids minted by lib/dbCare may become channels here. */
function careChannel(sessionId: string): string {
  return /^SESS_[0-9A-F]{20}$/.test(sessionId) ? `customer:${sessionId}` : "";
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
    }

    const parsed = POST_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }

    const { sessionId, text, imageDataUrl } = parsed.data;

    const channel = careChannel(sessionId);
    if (!channel) return NextResponse.json({ error: "sessionId không hợp lệ." }, { status: 400 });

    const care = await dbCare.find(sessionId);
    if (!care) return NextResponse.json({ error: "Không tìm thấy phiên chat." }, { status: 404 });
    if (care.status === "closed") {
      return NextResponse.json({ error: "Phiên này đã kết thúc." }, { status: 410 });
    }

    // Lưu ảnh nếu có (chuyển từ base64 thành file an toàn)
    let imageUrl: string | null = null;
    if (imageDataUrl) {
      try {
        imageUrl = await saveChatImage(imageDataUrl);
      } catch {
        // Nếu ảnh không hợp lệ, tiếp tục mà không đính kèm
        imageUrl = null;
      }
    }

    // Tạo tin nhắn khách hàng — sử dụng đúng interface từ dbChat
    const msg: ChatMessage = {
      id: `MSG_CUST_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      channel,
      staffId: "CUSTOMER",
      staffName: care.customerName,
      staffAvatarUrl: null,
      imageUrl,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      replyToId: null,
      replyToPreview: null,
      replyToName: null,
      reactions: [],
      recalled: false,
      recalledAt: null,
    };

    // Lưu vào JSON store
    const saved = await dbChat.create({
      channel: msg.channel,
      staffId: msg.staffId,
      staffName: msg.staffName,
      staffAvatarUrl: msg.staffAvatarUrl,
      imageUrl: msg.imageUrl,
      text: msg.text,
      replyToId: msg.replyToId,
    });

    // Realtime cho các màn hình nhân viên đang mở: card yêu cầu của cả team
    publish("customer:requests", "customer:request", {
      sessionId,
      messageId: saved.id,
      preview: saved.text.slice(0, 120) || (saved.imageUrl ? "Ảnh đính kèm" : ""),
      time: saved.createdAt,
    });

    // Tin nhắn vào đúng thread mà nhân viên đã tiếp nhận — trang chăm sóc
    // khách hàng của nhân viên nghe sự kiện này thay vì phải poll ngược.
    publish(STAFF_CARE_CHANNEL, "care:message", { sessionId, message: saved });

    return NextResponse.json({ success: true, message: saved }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Không thể gửi tin nhắn." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = (searchParams.get("sessionId") ?? "").trim();
  const since = searchParams.get("since");

  const channel = careChannel(sessionId);
  if (!channel) return NextResponse.json({ error: "sessionId không hợp lệ." }, { status: 400 });

  try {
    const messages = since ? await dbChat.listSince(channel, since) : await dbChat.list(channel);
    // Trạng thái "nhân viên đang nhập" đi kèm mỗi nhịp poll 3 giây của trang
    // khách — trang này không mở EventSource nên đây là nguồn realtime của nó.
    return NextResponse.json({ messages, channel, staffTyping: isTyping(sessionId, "staff") });
  } catch {
    return NextResponse.json({ error: "Không đọc được tin nhắn." }, { status: 500 });
  }
}
