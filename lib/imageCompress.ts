/**
 * lib/imageCompress.ts
 * Client-side image downscaling, shared by the chat composer and the avatar
 * picker.
//
// WHY IT EXISTS
//   A modern phone photo is 3-6 MB. Sent as a base64 data URL (the only way to
//   attach an image to a JSON POST without a multipart round trip) that inflates
//   by 4/3 into 4-8 MB of request body — past both the 1 MB generic API limit in
//   security/config.ts and the 12 MB upload ceiling, and it would be re-encoded
//   and re-downloaded by every recipient in the thread. Downscaling in the
//   browser turns a 5 MB photo into ~120 KB with no visible difference at chat
//   or avatar size.
//
// WHY THE PROGRESSIVE QUALITY LOOP
//   A single fixed quality cannot satisfy both a 1280px screenshot and a
//   1280px photo of a dark clinic interior — the latter needs to drop to ~0.45
//   before it fits, and baking that in would over-compress the former. Stepping
//   down until the result fits costs a few milliseconds of canvas work (which
//   happens off the main thread) and gets both cases right.
 *
 * BROWSER-ONLY. Uses createImageBitmap and HTMLCanvasElement; never imported
 * from a server component or a route handler.
 */

/** Longest edge after scaling. 1280 covers a retina phone screen comfortably. */
export const MAX_EDGE = 1280;

/** Decoded-byte ceiling for a compressed image. */
export const MAX_OUTPUT_BYTES = 1_200_000;

/** Reject the source outright above this — resizing a 40 MB TIFF is a waste. */
export const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

/** Quality steps, tried in order until the output fits. */
const QUALITY_STEPS = [0.72, 0.6, 0.45, 0.3] as const;

/**
 * Decode + downscale + re-encode.
 *
 * Returns a JPEG data URL, or null when the file is not an image, is too large,
 * or cannot be decoded (a corrupt file, or a format the browser cannot decode —
 * HEIC from an iPhone is the common one, and there is nothing useful to do about
 * it here beyond telling the caller to pick a different file).
 */
export async function compressImage(file: File): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!file.type.startsWith('image/')) return null;
  if (file.size > MAX_SOURCE_BYTES) return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);

    for (const quality of QUALITY_STEPS) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      // base64 inflates by 4/3; compare the DECODED size so the limit means bytes.
      const bytes = Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
      if (bytes <= MAX_OUTPUT_BYTES) return dataUrl;
    }
    return null;
  } finally {
    // Free the decoded bitmap even when we bailed out mid-loop — a leaked
    // ImageBitmap holds the full-resolution pixel buffer until GC runs.
    bitmap.close();
  }
}

/** Human-readable approximate size, for the "đã nén còn ~120 KB" hint. */
export function approximateKb(dataUrl: string): number {
  return Math.round(Math.round(dataUrl.length * 0.75) / 1024);
}