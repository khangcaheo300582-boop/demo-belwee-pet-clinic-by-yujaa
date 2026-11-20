import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/staffSession';
import { roleCan, permissionDeniedMessage, type StaffAction } from '@/lib/staffPermissions';
import { dbMedicalRecords, type MedicalFile } from '@/lib/dbMedicalRecords';
import { audit, clientIpFrom } from '@/security/audit';

const PATCH_SCHEMA = z.object({
  status: z.enum(['CONFIRMED', 'COMPLETED']).optional(),
  diagnose: z.string().trim().max(2000).nullable().optional(),
  treatment: z.string().trim().max(2000).nullable().optional(),
  files: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        fileUrl: z.string(),
        fileType: z.string(),
        size: z.number(),
        uploadedAt: z.string().optional(),
      })
    )
    .max(20)
    .optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireStaff();
  if ('error' in session) return session.error;

  const record = await dbMedicalRecords.findById(params.id);
  if (!record) {
    return NextResponse.json({ message: 'Không tìm thấy bệnh án.' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const parsed = PATCH_SCHEMA.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ message: first?.message || 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  // Only allow forward status transitions.
  const nextStatus = parsed.data.status;
  if (nextStatus) {
    const order = { PENDING: 0, CONFIRMED: 1, COMPLETED: 2 } as const;
    if (order[nextStatus] < order[record.status]) {
      return NextResponse.json({ message: 'Không thể chuyển trạng thái lùi.' }, { status: 400 });
    }
  }

  // Authorisation: writing clinical text is diagnosis:write; flipping a record
  // to COMPLETED is a money action because the customer portal treats a
  // COMPLETED record as a finished visit. Both must be granted.
  const requiredActions: StaffAction[] = [];
  if (nextStatus === 'COMPLETED') requiredActions.push('billing:write');
  if (nextStatus === 'CONFIRMED') requiredActions.push('appointment:confirm');
  if (parsed.data.diagnose !== undefined || parsed.data.treatment !== undefined) {
    requiredActions.push('diagnosis:write');
  }
  const denied = requiredActions.find(action => !roleCan(session.staff.role, action));
  if (denied) {
    await audit('STAFF_ACCESS_DENIED', {
      ip: clientIpFrom(request),
      staffId: session.staff.id,
      email: session.staff.email,
      detail: `${denied} on PATCH /api/staff/records/${params.id}`,
    });
    return NextResponse.json({ message: permissionDeniedMessage(denied) }, { status: 403 });
  }

  const updated = await dbMedicalRecords.update(params.id, {
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.diagnose !== undefined ? { diagnose: parsed.data.diagnose } : {}),
    ...(parsed.data.treatment !== undefined ? { treatment: parsed.data.treatment } : {}),
    ...(parsed.data.files ? { files: parsed.data.files as MedicalFile[] } : {}),
    ...(nextStatus ? { staffId: session.staff.id, staffName: session.staff.name } : {}),
  });

  if (!updated) {
    return NextResponse.json({ message: 'Không tìm thấy bệnh án.' }, { status: 404 });
  }

  // Fact-only audit: never log the diagnosis/treatment text itself.
  await audit('STAFF_DIAGNOSIS_SAVED', {
    ip: clientIpFrom(request),
    staffId: session.staff.id,
    email: session.staff.email,
    detail: `record=${params.id} via /api/staff/records status=${nextStatus ?? 'unchanged'}`,
  });

  return NextResponse.json({ record: updated });
}
