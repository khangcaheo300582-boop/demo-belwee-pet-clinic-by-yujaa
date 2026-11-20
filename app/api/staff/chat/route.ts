// app/api/staff/chat/route.ts
// Internal staff chat HTTP API.
//
//   GET  ?channel=…&since=…   recent history or messages after a gap
//   GET  ?channel=…&before=…  one older page for manual history browsing
//   POST { channel, text, imageDataUrl?, replyToId? }
//
// Realtime delivery is NOT here — the write publishes to lib/realtime.ts so
// every subscribed browser gets it over the SSE stream. This route only
// persists and returns the row.
//
// WHY PERSIST IS AUTHORITATIVE
//   A message must survive the sender's own tab closing. Writing to the store
//   first and publishing second means the message exists even if the process
//   dies between the two, and the next fetch reconciles.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAction } from '@/lib/staffSession';
import { dbChat, validateMessage, MAX_TEXT_LENGTH } from '@/lib/dbChat';
import { publish } from '@/lib/realtime';
import { chatChannelsFor } from '@/lib/channels';
import { audit, clientIpFrom } from '@/security/audit';
import { saveChatImage, removeChatImage } from '@/lib/chatImages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POST_SCHEMA = z.object({
  channel: z.string().min(1),
  text: z.string().max(MAX_TEXT_LENGTH * 2).optional().default(''),
  imageDataUrl: z.string().max(2_000_000).nullable().optional(),
  replyToId: z.string().max(64).nullable().optional(),
});

// NOTE on the response shape: success uses `message` (the created row) and
// failure uses `error` (a string). They deliberately do not share a key — an
// earlier version returned `{ message: 'lỗi' }` on failure and `{ message: row }`
// on success, so the client could not tell an error string from a message object
// without checking `res.ok` first, and one missed check turned an error into a
// rendered "undefined" bubble.

export async function GET(request: NextRequest) {
  const session = await requireStaffAction('staff:chat');
  if ('error' in session) return session.error;

  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel') ?? '';
  const since = searchParams.get('since');
  const before = searchParams.get('before');
  const beforeId = searchParams.get('beforeId');

  // A staff member may only read channels they belong to — the group channel or
  // their own branch. Checking here rather than trusting the query stops one
  // employee reading another branch's conversation by editing a URL.
  if (!chatChannelsFor(session.staff.branchId).includes(channel)) {
    return NextResponse.json({ error: 'Bạn không có quyền đọc kênh này.' }, { status: 403 });
  }

  if (!since && before && beforeId) {
    const page = await dbChat.listBefore(channel, beforeId, before);
    return NextResponse.json({ ...page, channel, total: page.messages.length });
  }

  const messages = since ? await dbChat.listSince(channel, since) : await dbChat.list(channel);
  const hasMore = !since && messages.length > 0
    ? (await dbChat.listBefore(channel, messages[0].id, messages[0].createdAt, 1)).messages.length > 0
    : false;
  return NextResponse.json({ messages, hasMore, channel, total: messages.length });
}

export async function POST(request: NextRequest) {
  const session = await requireStaffAction('staff:chat');
  if ('error' in session) return session.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const parsed = POST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message || 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  const { channel, text, imageDataUrl, replyToId } = parsed.data;
  if (!chatChannelsFor(session.staff.branchId).includes(channel)) {
    return NextResponse.json({ error: 'Bạn không có quyền gửi vào kênh này.' }, { status: 403 });
  }

  const check = validateMessage(text, imageDataUrl ?? null);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const imageUrl = imageDataUrl ? await saveChatImage(imageDataUrl) : null;
  let message;
  try {
    message = await dbChat.create({
      channel,
      staffId: session.staff.id,
      staffName: session.staff.name,
      staffAvatarUrl: session.staff.avatarUrl,
      text,
      imageUrl,
      replyToId: replyToId ?? null,
    });
  } catch (error) {
    await removeChatImage(imageUrl);
    throw error;
  }

  publish(channel, 'chat:message', message);

  // Audit the fact and the shape only — never the content.
  await audit('STAFF_CHAT_MESSAGE', {
    ip: clientIpFrom(request),
    staffId: session.staff.id,
    email: session.staff.email,
    detail: `message=${message.id} channel=${channel} image=${message.imageUrl ? 'yes' : 'no'} reply=${message.replyToId ?? 'no'}`,
  });

  return NextResponse.json({ message }, { status: 201 });
}