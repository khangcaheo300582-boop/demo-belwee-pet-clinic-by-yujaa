// lib/dbChat.ts
// File-backed staff chat persistence (data/chat.json).
//
// WHY FILE-BACKED: this module used to open a mongoose connection per request.
// A paused Atlas cluster meant the staff chat spun for 10 seconds and then
// answered 500 — for a feature whose entire dataset is a single JSON file that
// already exists in the repo's data directory. lib/jsonStore serialises
// read-modify-write, which is exactly the guarantee a chat transcript needs
// (two reactions landing at once must not drop one).

import { createAsyncJsonStore } from './jsonStore';
import { removeChatImage } from './chatImages';
import {
  ALLOWED_REACTIONS,
  MAX_TEXT_LENGTH,
  MAX_IMAGE_BYTES,
  PAGE_SIZE,
  type ChatMessage,
  type ChatReaction,
  type ReactionEmoji,
} from './chatShared';

export {
  ALLOWED_REACTIONS,
  MAX_TEXT_LENGTH,
  MAX_IMAGE_BYTES,
  PAGE_SIZE,
  groupByDay,
  type ChatMessage,
  type ChatReaction,
  type ReactionEmoji,
} from './chatShared';

const MAX_ROWS = 2000;

function generateMessageId(): string {
  return `MSG_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export function isValidImageDataUrl(value: string): boolean {
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return false;
  return Math.floor((match[2].length * 3) / 4) <= MAX_IMAGE_BYTES;
}

export interface NewMessageInput {
  channel: string;
  staffId: string;
  staffName: string;
  staffAvatarUrl: string | null;
  text: string;
  imageUrl: string | null;
  replyToId: string | null;
}

export function validateMessage(
  text: string,
  imageDataUrl: string | null
): { ok: true } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed && !imageDataUrl) {
    return { ok: false, error: 'Tin nhắn rỗng — hãy nhập nội dung hoặc đính kèm ảnh.' };
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `Nội dung tối đa ${MAX_TEXT_LENGTH} ký tự.` };
  }
  if (imageDataUrl && !isValidImageDataUrl(imageDataUrl)) {
    return { ok: false, error: 'Ảnh không hợp lệ hoặc vượt quá 1,2 MB.' };
  }
  return { ok: true };
}

function normalizeReactions(value: unknown): ChatReaction[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((reaction): reaction is Record<string, unknown> => !!reaction && typeof reaction === 'object')
    .map((reaction) => ({
      emoji: String(reaction.emoji ?? ''),
      staffIds: Array.isArray(reaction.staffIds) ? reaction.staffIds.map(String) : [],
    }))
    .filter((reaction) => reaction.emoji.length > 0);
}

/**
 * data/chat.json predates the "store the file, keep a URL" split: old rows
 * carry the image as `imageDataUrl`, which the client no longer understands.
 * Normalising on read keeps those messages visible instead of silently
 * rendering an empty bubble.
 */
const chatStore = createAsyncJsonStore<ChatMessage>('chat.json', (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => typeof row.id === 'string' && typeof row.channel === 'string')
    .map((row) => {
      const legacyImage = typeof row.imageDataUrl === 'string' ? row.imageDataUrl : null;
      return {
        id: row.id as string,
        channel: row.channel as string,
        staffId: typeof row.staffId === 'string' ? row.staffId : '',
        staffName: typeof row.staffName === 'string' ? row.staffName : '',
        staffAvatarUrl: typeof row.staffAvatarUrl === 'string' ? row.staffAvatarUrl : null,
        imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : legacyImage,
        text: typeof row.text === 'string' ? row.text : '',
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
        replyToId: typeof row.replyToId === 'string' ? row.replyToId : null,
        replyToPreview: typeof row.replyToPreview === 'string' ? row.replyToPreview : null,
        replyToName: typeof row.replyToName === 'string' ? row.replyToName : null,
        reactions: normalizeReactions(row.reactions),
        recalled: row.recalled === true,
        recalledAt: typeof row.recalledAt === 'string' ? row.recalledAt : null,
      };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
});

function pageSize(limit: number): number {
  return Math.max(1, Math.min(MAX_ROWS, limit));
}

export const dbChat = {
  async list(channel: string, limit = PAGE_SIZE): Promise<ChatMessage[]> {
    const rows = (await chatStore.read()).filter((row) => row.channel === channel);
    return rows.slice(Math.max(0, rows.length - pageSize(limit)));
  },

  async listBefore(
    channel: string,
    beforeId: string,
    before: string,
    limit = PAGE_SIZE
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    const rows = await chatStore.read();
    const cursorRow = rows.find((row) => row.id === beforeId && row.channel === channel);
    const cursorIso = cursorRow?.createdAt ?? before;
    if (Number.isNaN(new Date(cursorIso).getTime())) return { messages: [], hasMore: false };

    const pageLimit = pageSize(limit);
    const older = rows
      .filter((row) => row.channel === channel && row.createdAt < cursorIso)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const hasMore = older.length > pageLimit;
    return {
      messages: older.slice(0, pageLimit).reverse(),
      hasMore,
    };
  },

  async listSince(channel: string, since: string, limit = MAX_ROWS): Promise<ChatMessage[]> {
    const sinceMs = new Date(since).getTime();
    if (Number.isNaN(sinceMs)) return [];
    const sinceIso = new Date(sinceMs).toISOString();
    return (await chatStore.read())
      .filter((row) => row.channel === channel && row.createdAt > sinceIso)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, pageSize(limit));
  },

  async findById(id: string): Promise<ChatMessage | undefined> {
    return (await chatStore.read()).find((row) => row.id === id);
  },

  async create(input: NewMessageInput): Promise<ChatMessage> {
    const removedImages: (string | null)[] = [];

    const message = await chatStore.update((rows) => {
      const parent = input.replyToId
        ? rows.find((row) => row.id === input.replyToId && row.channel === input.channel)
        : undefined;

      const created: ChatMessage = {
        id: generateMessageId(),
        channel: input.channel,
        staffId: input.staffId,
        staffName: input.staffName,
        staffAvatarUrl: input.staffAvatarUrl,
        imageUrl: input.imageUrl,
        text: input.text.trim(),
        createdAt: new Date().toISOString(),
        replyToId: parent?.id ?? null,
        replyToPreview: parent
          ? parent.recalled
            ? null
            : parent.imageUrl && !parent.text
              ? 'Ảnh'
              : parent.text.slice(0, 120)
          : null,
        replyToName: parent?.staffName ?? null,
        reactions: [],
        recalled: false,
        recalledAt: null,
      };

      rows.push(created);

      if (rows.length > MAX_ROWS) {
        const keep = new Set(
          [...rows]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, MAX_ROWS)
            .map((row) => row.id)
        );
        for (const row of rows) {
          if (!keep.has(row.id)) removedImages.push(row.imageUrl);
        }
        const survivors = rows.filter((row) => keep.has(row.id));
        rows.length = 0;
        rows.push(...survivors);
      }

      return created;
    });

    // Best effort: the transcript is already committed, and a failed unlink
    // must not turn a successful send into an error for the user.
    await Promise.all(removedImages.map((url) => removeChatImage(url).catch(() => undefined)));

    return message;
  },

  async toggleReaction(
    id: string,
    staffId: string,
    emoji: string
  ): Promise<{ ok: true; message: ChatMessage } | { ok: false; error: string }> {
    if (!ALLOWED_REACTIONS.includes(emoji as ReactionEmoji)) {
      return { ok: false, error: 'Biểu tượng cảm xúc không hợp lệ.' };
    }

    return chatStore.update((rows) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) return { ok: false as const, error: 'Không tìm thấy tin nhắn.' };
      if (row.recalled) return { ok: false as const, error: 'Không thể thả biểu tượng lên tin đã thu hồi.' };

      const existing = row.reactions.find((reaction) => reaction.emoji === emoji);
      if (existing) {
        const at = existing.staffIds.indexOf(staffId);
        if (at !== -1) existing.staffIds.splice(at, 1);
        else existing.staffIds.push(staffId);
      } else {
        row.reactions.push({ emoji, staffIds: [staffId] });
      }
      row.reactions = row.reactions.filter((reaction) => reaction.staffIds.length > 0);

      return { ok: true as const, message: { ...row, reactions: row.reactions.map((r) => ({ ...r, staffIds: [...r.staffIds] })) } };
    });
  },

  async recall(id: string, staffId: string): Promise<{ ok: true; message: ChatMessage } | { ok: false; error: string }> {
    return chatStore.update((rows) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) return { ok: false as const, error: 'Không tìm thấy tin nhắn.' };
      if (row.staffId !== staffId) return { ok: false as const, error: 'Bạn chỉ có thể thu hồi tin nhắn của chính mình.' };
      if (row.recalled) return { ok: true as const, message: { ...row } };

      row.recalled = true;
      row.recalledAt = new Date().toISOString();
      row.text = '';
      row.imageUrl = null;
      row.reactions = [];
      return { ok: true as const, message: { ...row } };
    });
  },

  async count(): Promise<number> {
    return (await chatStore.read()).length;
  },
};
