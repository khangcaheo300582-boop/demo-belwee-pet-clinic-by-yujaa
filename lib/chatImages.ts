import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { MAX_IMAGE_BYTES } from './chatShared';
import { safeExtensionFor, sniffMatches } from '../security/upload';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');
const CHAT_FILE_PREFIX = 'chat-';

export async function saveChatImage(dataUrl: string): Promise<string> {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('Chat image format is not supported.');
  const mime = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_IMAGE_BYTES || !sniffMatches(mime, buffer)) {
    throw new Error('Chat image content does not match its declared format.');
  }
  const extension = safeExtensionFor(mime);
  if (!extension) throw new Error('Chat image format is not supported.');
  const filename = `${CHAT_FILE_PREFIX}${crypto.randomUUID()}.${extension}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer, { flag: 'wx' });
  return `/api/staff/files/${filename}`;
}

export async function removeChatImage(fileUrl: string | null | undefined): Promise<void> {
  if (!fileUrl) return;
  const name = fileUrl.split(/[?#]/)[0].split('/').pop() ?? '';
  if (!name.startsWith(CHAT_FILE_PREFIX) || /[^a-zA-Z0-9._-]/.test(name)) return;
  const root = path.resolve(UPLOAD_DIR);
  const target = path.resolve(root, name);
  if (!target.startsWith(root + path.sep)) throw new Error('Refusing to remove a path outside chat storage.');
  try {
    await fs.unlink(target);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
}
