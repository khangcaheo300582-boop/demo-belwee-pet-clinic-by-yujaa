// app/api/staff/chat/customer/route.ts
// The staff side of a customer-care transcript (channel `customer:<sessionId>`).
//
//   GET  ?sessionId=…      → history / pages for the care chat screen
//   POST { sessionId, text, imageDataUrl? }
//                          → reply as myself; only the member who ACCEPTED
//                            the request may write into the transcript
//
// Realtime: staff pages learn about customer messages through the `staff:care`
// channel (`care:message`) — the customer's POST publishes there AND the
// existing glass notification (channel customer:requests) still fires for the
// whole team. Nothing here bypasses lib/dbChat, so the transcript survives
// restarts exactly like the internal chat.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffAction } from "@/lib/staffSession";
import { dbChat, validateMessage, MAX_TEXT_LENGTH } from "@/lib/dbChat";
import { dbCare } from "@/lib/dbCare";
import { saveChatImage, removeChatImage } from "@/lib/chatImages";
import { publish } from "@/lib/realtime";
import { STAFF_CARE_CHANNEL } from "@/lib/channels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function careChannel(sessionId: string): string {
  // The id comes from the server and is random; validate ("SESS_" + 20 hex
  // chars) so a caller cannot smuggle channel names via this parameter.
  return /^SESS_[0-9A-F]{20}$/.test(sessionId) ? `customer:${sessionId}` : "";
}

export async function GET(request: NextRequest) {
  const session = await requireStaffAction("staff:chat");
  if ("error" in session) return session.error;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId") ?? "";
  const since = searchParams.get("since");

  const channel = careChannel(sessionId);
  if (!channel) return NextResponse.json({ error: "sessionId không hợp lệ." }, { status: 400 });

  const messages = since ? await dbChat.listSince(channel, since) : await dbChat.list(channel);
  return NextResponse.json({ messages, channel });
}

const POST_SCHEMA = z.object({
  sessionId: z.string().min(8).max(40),
  text: z.string().max(MAX_TEXT_LENGTH * 2).optional().default(""),
  imageDataUrl: z.string().max(2_000_000).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireStaffAction("staff:chat");
  if ("error" in session) return session.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const parsed = POST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 }
    );
  }

  const { sessionId, text, imageDataUrl } = parsed.data;
  const channel = careChannel(sessionId);
  if (!channel) return NextResponse.json({ error: "sessionId không hợp lệ." }, { status: 400 });

  // Only the member who accepted may write here — anyone else would be
  // impersonating a doctor the customer already saw on their screen.
  const care = await dbCare.find(sessionId);
  if (!care) return NextResponse.json({ error: "Không tìm thấy phiên chăm sóc." }, { status: 404 });
  if (care.status !== "accepted" || care.accepted?.id !== session.staff.id) {
    return NextResponse.json(
      { error: "Bạn chưa tiếp nhận phiên này hoặc phiên đã kết thúc." },
      { status: 403 }
    );
  }

  const check = validateMessage(text, imageDataUrl ?? null);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  let imageUrl: string | null = null;
  try {
    imageUrl = imageDataUrl ? await saveChatImage(imageDataUrl) : null;
    const message = await dbChat.create({
      channel,
      staffId: session.staff.id,
      staffName: session.staff.name,
      staffAvatarUrl: session.staff.avatarUrl,
      text,
      imageUrl,
      replyToId: null,
    });

    // Live update for the doctor's own care screen + their teammate screens;
    // the customer learns about it through their status/message poll.
    publish(STAFF_CARE_CHANNEL, "care:message", { sessionId, message });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    await removeChatImage(imageUrl).catch(() => undefined);
    console.error("[staff/customer-chat] gửi thất bại:", error);
    return NextResponse.json({ error: "Không thể gửi tin nhắn." }, { status: 500 });
  }
}
