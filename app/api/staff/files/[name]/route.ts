// app/api/staff/files/[name]/route.ts
// Serves a medical attachment from data/uploads.
//
// Access rule: staff may read any file; a signed-in customer may only read
// files attached to THEIR OWN medical records. Previously the check was
// `if (!staff && !customerSession?.user)` — i.e. any signed-in customer could
// read every customer's X-ray by URL. Filenames are UUIDs so they are not
// guessable, but they leak through logs, referrers and copy-paste.

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';
import { getStaffSession } from '@/lib/staffSession';
import { dbMedicalRecords } from '@/lib/dbMedicalRecords';
import { safeAttachmentHeaders } from '@/security/upload';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
};

/** "/api/staff/files/<name>" → "<name>"; returns null for any other shape. */
function referencedFileName(fileUrl: string | null | undefined): string | null {
  if (typeof fileUrl !== 'string') return null;
  const marker = '/api/staff/files/';
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return null;
  const tail = fileUrl.slice(idx + marker.length).split(/[?#]/)[0];
  return tail || null;
}

/** Every record that references this stored file, via its `files` array. */
export async function GET(_request: Request, { params }: { params: { name: string } }) {
  const staff = await getStaffSession();
  const customerSession = await getServerSession(authOptions);
  const customerEmail = customerSession?.user?.email?.toLowerCase().trim() ?? null;

  if (!staff && !customerEmail) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const name = params.name.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!name) return NextResponse.json({ message: 'Tên file không hợp lệ.' }, { status: 400 });

  // Ownership gate for customers. Staff skip this entirely.
  // A file that is not referenced by any record has no owner to match, so it is
  // refused for customers (defence in depth against orphaned uploads) and still
  // served for staff, who need to inspect whatever landed on disk.
  if (!staff && customerEmail) {
    const fileUrl = `/api/staff/files/${name}`;
    const owners = referencedFileName(fileUrl) === name
      ? await dbMedicalRecords.findOwnersByFileUrl(fileUrl)
      : [];
    if (!owners.includes(customerEmail)) {
      return NextResponse.json({ message: 'Không tìm thấy file.' }, { status: 404 });
    }
  }

  const resolved = path.resolve(UPLOAD_DIR, name);
  // Path-traversal guard: the resolved path must stay inside the upload dir.
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR) + path.sep) || !fs.existsSync(resolved)) {
    return NextResponse.json({ message: 'Không tìm thấy file.' }, { status: 404 });
  }

  const ext = name.split('.').pop()?.toLowerCase() || '';
  const buffer = fs.readFileSync(resolved);
  return new NextResponse(buffer, {
    headers: {
      ...safeAttachmentHeaders(resolved, buffer),
      'Content-Type': MIME_BY_EXT[ext] || 'application/octet-stream',
    },
  });
}
