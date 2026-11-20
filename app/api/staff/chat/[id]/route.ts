// app/api/staff/chat/[id]/route.ts
// Mutate one chat message: react or recall.
//
//   PATCH  { action: 'react',   emoji }  → add/remove a reaction
//   DELETE                            → recall (author only)
//
// Both publish over the SSE stream so every connected member's bubble updates
// live. A recall is NOT a delete: see lib/dbChat.ts for why the tombstone
// matters.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAction } from '@/lib/staffSession';
import { dbChat, ALLOWED_REACTIONS } from '@/lib/dbChat';
import { publish } from '@/lib/realtime';
import { chatChannelsFor } from '@/lib/channels';
import { audit, clientIpFrom } from '@/security/audit';
import { removeChatImage } from '@/lib/chatImages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PATCH_SCHEMA = z.object({
  action: z.literal('react'),
  emoji: z.enum(ALLOWED_REACTIONS),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireStaffAction('staff:chat');
  if ('error' in session) return session.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const parsed = PATCH_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Biểu tượng cảm xúc không hợp lệ.' }, { status: 400 });
  }

  // Resolve the parent FIRST so we can check channel access before mutating.
  const existing = await dbChat.findById(params.id);
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy tin nhắn.' }, { status: 404 });
  if (!chatChannelsFor(session.staff.branchId).includes(existing.channel)) {
    return NextResponse.json({ error: 'Bạn không có quyền thao tác trên kênh này.' }, { status: 403 });
  }

  const result = await dbChat.toggleReaction(params.id, session.staff.id, parsed.data.emoji);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  publish(existing.channel, 'chat:reaction', result.message);
  await audit('STAFF_CHAT_MUTATED', {
    ip: clientIpFrom(request),
    staffId: session.staff.id,
    email: session.staff.email,
    detail: `reaction=${parsed.data.emoji} message=${params.id}`,
  });

  return NextResponse.json({ message: result.message });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireStaffAction('staff:chat');
  if ('error' in session) return session.error;

  const existing = await dbChat.findById(params.id);
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy tin nhắn.' }, { status: 404 });
  if (!chatChannelsFor(session.staff.branchId).includes(existing.channel)) {
    return NextResponse.json({ error: 'Bạn không có quyền thao tác trên kênh này.' }, { status: 403 });
  }

  const result = await dbChat.recall(params.id, session.staff.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });

  if (existing.imageUrl) await removeChatImage(existing.imageUrl);
  publish(existing.channel, 'chat:recall', result.message);
  await audit('STAFF_CHAT_MUTATED', {
    ip: clientIpFrom(request),
    staffId: session.staff.id,
    email: session.staff.email,
    detail: `recall message=${params.id}`,
  });

  return NextResponse.json({ message: result.message });
}