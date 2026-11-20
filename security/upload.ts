// security/upload.ts
// Hardened file upload / serving helpers (Node runtime only).
//
// 1. Upload validation: extension whitelist + magic-byte (sniff) verification.
//    SVG is deliberately EXCLUDED because it can carry scripts (stored XSS).
// 2. Serving: sanitized response headers so a stored file can never run as
//    active content in the origin (nosniff + content-disposition).
//
// Magic-byte signatures come from shared registries and are the leading bytes
// of each format; they are resistant to trivial extensions.

export interface AllowedType {
  mime: string;
  extensions: string[];
  /** Byte layout the first `bytes.length` bytes must match. */
  magic: { bytes: number[]; offset?: number };
}

const M: Record<string, AllowedType> = {
  jpeg: {
    mime: 'image/jpeg',
    extensions: ['jpg', 'jpeg'],
    magic: { bytes: [0xff, 0xd8, 0xff] },
  },
  png: {
    mime: 'image/png',
    extensions: ['png'],
    magic: { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  },
  webp: {
    mime: 'image/webp',
    extensions: ['webp'],
    magic: { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF....WEBP
  },
  gif: {
    mime: 'image/gif',
    extensions: ['gif'],
    magic: { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // includes 89a check below
  },
  pdf: {
    mime: 'application/pdf',
    extensions: ['pdf'],
    magic: { bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  },
  txt: {
    mime: 'text/plain',
    extensions: ['txt'],
    magic: { bytes: [] }, // no reliable signature → text only
  },
};

export function isAllowedMime(mime: string): boolean {
  return Object.values(M).some(t => t.mime === mime);
}

/** Deterministic server-chosen extension from an allowed type, never from user input. */
export function safeExtensionFor(mime: string): string | null {
  const type = Object.values(M).find(t => t.mime === mime);
  return type ? type.extensions[0] : null;
}

/** Verify the file's leading bytes match the claimed type. */
export function sniffMatches(mime: string, data: Uint8Array): boolean {
  // Look the type up by MIME. Going through `safeExtensionFor` returned the
  // registry's FIRST extension, so `image/jpeg` resolved to "jpg" — not a key of
  // M (the key is "jpeg") — and every JPEG failed this check and was rejected as
  // "content does not match its declared format".
  const type = Object.values(M).find(t => t.mime === mime);
  if (!type) return false;
  if (type.magic.bytes.length === 0) return true; // no signature (txt)

  const offset = type.magic.offset ?? 0;
  const magic = type.magic.bytes;
  for (let i = 0; i < magic.length; i += 1) {
    const idx = offset + i;
    if (idx >= data.length || data[idx] !== magic[i]) return false;
  }
  // WebP: confirm the "WEBP" chunk follows the RIFF header.
  if (mime === 'image/webp') {
    if (data.length < 12) return false;
    const tag = String.fromCharCode(data[8], data[9], data[10], data[11]);
    if (tag !== 'WEBP') return false;
  }
  // GIF: accept both "87a" and "89a".
  if (mime === 'image/gif') {
    const ver = String.fromCharCode(data[4], data[5], data[6]);
    if (ver !== '87a' && ver !== '89a') return false;
  }
  return true;
}

export const ALLOWED_UPLOAD_MIMES = Object.values(M).map(t => t.mime);

/** Response headers that prevent a stored file from executing in the origin. */
export function safeAttachmentHeaders(
  filePath: string,
  buffer: Buffer,
): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Length': String(buffer.length),
    'Content-Disposition': `inline; filename="${encodeURIComponent(filePath.split('/').pop() || 'file')}"`,
    // Audible + visual XSS defence for any mislabelled content.
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  };
  return headers;
}
