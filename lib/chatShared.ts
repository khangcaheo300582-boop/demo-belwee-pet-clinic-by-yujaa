/**
 * lib/chatShared.ts
 * The parts of the chat model that are safe to import from a CLIENT component.
 *
 * WHY THIS FILE IS SPLIT OUT
 *   lib/dbChat.ts imports fs (through lib/jsonStore) to persist messages. A
 *   "use client" component that imports anything from dbChat pulls that fs
 *   dependency into the browser bundle, and the build fails with
 *   "Module not found: Can't resolve 'fs'".
 *
 *   So everything the client needs — the message type, the reaction whitelist,
 *   the limits, and the pure day-grouper — lives here, and dbChat imports FROM
 *   this file rather than defining them. One definition, two consumers, no
 *   duplication and no server code in the bundle.
 */

export interface ChatReaction {
  emoji: string;
  /** Staff ids that reacted. Count is derived, never stored. */
  staffIds: string[];
}

export interface ChatMessage {
  id: string;
  channel: string;
  staffId: string;
  /** Denormalised so a renamed staff member does not rewrite history. */
  staffName: string;
  staffAvatarUrl: string | null;
  /** null for a plain text message. */
  imageUrl: string | null;
  text: string;
  createdAt: string;
  /** Set when the message replies to another. */
  replyToId: string | null;
  /** Snippet of the replied-to message, so a deleted parent still reads right. */
  replyToPreview: string | null;
  replyToName: string | null;
  reactions: ChatReaction[];
  /** True once the author recalled it — `text`/`imageUrl` are cleared. */
  recalled: boolean;
  recalledAt: string | null;
}

/** Only these five. Anything else is rejected server-side. */
export const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢'] as const;
export type ReactionEmoji = (typeof ALLOWED_REACTIONS)[number];

export const MAX_TEXT_LENGTH = 2000;
export const MAX_IMAGE_BYTES = 1_200_000;

/** Messages returned per fetch page. */
export const PAGE_SIZE = 60;

/**
 * Group messages by calendar day for the date separators in the chat list.
 *
 * Pure and dependency-free so both the client (rendering) and the server
 * (anything that needs the shape) can call it.
 */
export function groupByDay(messages: ChatMessage[]): Array<{ day: string; items: ChatMessage[] }> {
  const groups: Array<{ day: string; items: ChatMessage[] }> = [];
  for (const message of messages) {
    const day = new Date(message.createdAt).toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(message);
    else groups.push({ day, items: [message] });
  }
  return groups;
}

/**
 * Toggle one staff id inside one emoji bucket, returning a NEW array.
 *
 * Shared so the optimistic update in the client produces byte-identical state
 * to what the server will send back — a locally-reimplemented version is how a
 * reaction count ends up permanently off by one.
 */
export function applyOptimisticReaction(
  reactions: ChatReaction[],
  emoji: string,
  staffId: string
): ChatReaction[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (!existing) return [...reactions, { emoji, staffIds: [staffId] }];
  const already = existing.staffIds.includes(staffId);
  return reactions
    .map((r) =>
      r.emoji === emoji
        ? {
            ...r,
            staffIds: already ? r.staffIds.filter((id) => id !== staffId) : [...r.staffIds, staffId],
          }
        : r
    )
    .filter((r) => r.staffIds.length > 0);
}