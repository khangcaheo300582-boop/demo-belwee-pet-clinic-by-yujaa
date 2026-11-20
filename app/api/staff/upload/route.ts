// app/api/staff/upload/route.ts
// Stores validated medical files under data/uploads (gitignored, next to the JSON stores)
// and serves them back through GET /api/staff/files/<name>.
// Hardened: extension whitelist + magic-byte sniffing; SVG is rejected (stored-XSS risk).

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { requireStaffAction } from '@/lib/staffSession';
import { audit, clientIpFrom } from '@/security/audit';
import {
  isAllowedMime,
  safeExtensionFor,
  sniffMatches,
} from '@/security/upload';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

export async function POST(request: NextRequest) {
  const session = await requireStaffAction('file:upload');
  if ('error' in session) return session.error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: 'Không đọc được dữ liệu tải lên.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ message: 'Thiếu file trong yêu cầu.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ message: 'File vượt quá 10 MB.' }, { status: 413 });
  }
  if (!isAllowedMime(file.type)) {
    return NextResponse.json(
      { message: 'Định dạng file không được hỗ trợ (JPG / PNG / WebP / GIF / PDF / TXT).' },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = safeExtensionFor(file.type);
  if (!ext || !sniffMatches(file.type, new Uint8Array(buffer))) {
    return NextResponse.json({ message: 'Nội dung file không khớp với định dạng khai báo.' }, { status: 415 });
  }

  const id = crypto.randomUUID();
  const fileName = `${id}.${ext}`;

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer);

  // 'UPLOAD' was declared in the AuditEvent union but never emitted, so a file
  // appearing in data/uploads had no attributable trail. Log who put it there.
  // The original filename is a PHI-bearing string (often the patient's name) —
  // record only its extension and size.
  await audit('UPLOAD', {
    ip: clientIpFrom(request),
    staffId: session.staff.id,
    email: session.staff.email,
    detail: `file=${fileName} type=${file.type} size=${file.size}`,
  });

  return NextResponse.json({
    file: {
      id,
      name: file.name,
      fileUrl: `/api/staff/files/${fileName}`,
      fileType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    },
  });
}
