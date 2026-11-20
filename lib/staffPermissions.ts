// lib/staffPermissions.ts
// The staff role matrix — ONE source of truth for "which role may do what".
//
// Before this file existed, `StaffRole = 'ADMIN' | 'VET' | 'RECEPTIONIST'` was
// declared in lib/staff-service.ts, written into data/staff.json, displayed in
// the dashboard header… and then never consulted. Every mutating route called
// `requireStaff()`, so a RECEPTIONIST account could write a veterinary
// diagnosis, and a VET could cancel appointments. The role was decorative.
//
// Matrix (see docs/staff-rbac.md for the rationale):
//
//   action                 ADMIN  VET  SPA  RECEPTIONIST  INTERN  MARKETING
//   appointment:view         ✓     ✓    ✓         ✓          ✓        ✓
//   appointment:confirm      ✓     ✓    ✓         ✓          ✗        ✗
//   appointment:cancel       ✓     ✗    ✗         ✓          ✗        ✗
//   diagnosis:write          ✓     ✓    ✓         ✗          ✗        ✗
//   file:upload              ✓     ✓    ✓         ✓          ✗        ✗
//   billing:write            ✓     ✗    ✗         ✓          ✗        ✗
//   staff:team               ✓     ✓    ✓         ✓          ✓        ✓
//   staff:chat               ✓     ✓    ✓         ✓          ✗        ✓
//   staff:rules              ✓     ✓    ✓         ✓          ✓        ✓
//   staff:grant              ✓     ✗    ✗         ✗          ✗        ✗
//
//   • VET owns the clinical work: diagnosis, treatment plan, attachments.
//     Money and cancellations are not theirs.
//   • SPA works in the treatment room: treatment notes and files, no money.
//   • RECEPTIONIST owns the front desk: confirmations, cancellations and
//     billing. They must not write clinical notes — a note typed by a
//     receptionist is indistinguishable from a vet's in the medical record.
//   • INTERN is supervised: read-only over the queue, plus the handbook.
//   • MARKETING reads the queue but never writes the clinical or financial
//     record: view-only, no confirm, no diagnosis, no billing.
//   • ADMIN can do everything; the matrix must never lock an admin out of
//     their own dashboard.
//
// `staff:grant` is the only permission that hands out further access (a manager
// PIN creates an ADMIN), so it is deliberately ADMIN-only.
//
// `appointment:complete` deliberately has NO action of its own: the PATCH route
// only allows COMPLETED when a receipt already exists, so completing a booking
// is a money action and is gated by `billing:write`.
//
// Unknown / missing / lowercase roles get an EMPTY set (deny by default), so a
// corrupted data/staff.json can never widen access.

import type { StaffRole } from './staff-service';

export type StaffAction =
  | 'appointment:view'
  | 'appointment:confirm'
  | 'appointment:cancel'
  | 'diagnosis:write'
  | 'file:upload'
  | 'billing:write'
  // Staff-area content: the team directory, the internal chat and the rules
  // page. Split out from `appointment:view` so a future contractor account can
  // read the handbook without ever seeing the customer queue.
  | 'staff:team'
  | 'staff:chat'
  | 'staff:rules'
  // Granting a PIN to create an account is an ADMIN-only action — it is the
  // one permission that hands out further access.
  | 'staff:grant';

export const STAFF_ACTIONS: readonly StaffAction[] = [
  'appointment:view',
  'appointment:confirm',
  'appointment:cancel',
  'diagnosis:write',
  'file:upload',
  'billing:write',
  'staff:team',
  'staff:chat',
  'staff:rules',
  'staff:grant',
];

const ALL: ReadonlySet<StaffAction> = new Set(STAFF_ACTIONS);

const MATRIX: Record<StaffRole, ReadonlySet<StaffAction>> = {
  ADMIN: ALL,
  // VET owns the clinical work: diagnosis, treatment plan, attachments.
  // Money and cancellations are not theirs.
  VET: new Set<StaffAction>([
    'appointment:view',
    'appointment:confirm',
    'diagnosis:write',
    'file:upload',
    'staff:team',
    'staff:chat',
    'staff:rules',
  ]),
  // SPA specialists work in the treatment room and write notes on what they did,
  // but they never bill and never cancel a customer's appointment.
  SPA: new Set<StaffAction>([
    'appointment:view',
    'appointment:confirm',
    'diagnosis:write',
    'file:upload',
    'staff:team',
    'staff:chat',
    'staff:rules',
  ]),
  // RECEPTIONIST owns the front desk: confirmations, cancellations and billing.
  // They must not write clinical notes — a note typed by a receptionist is
  // indistinguishable from a vet's in the medical record.
  RECEPTIONIST: new Set<StaffAction>([
    'appointment:view',
    'appointment:confirm',
    'appointment:cancel',
    'file:upload',
    'billing:write',
    'staff:team',
    'staff:chat',
    'staff:rules',
  ]),
  // INTERN: supervised. They can look up a booking and read the handbook, and
  // nothing else — no confirmation, no notes, no money.
  INTERN: new Set<StaffAction>([
    'appointment:view',
    'staff:team',
    'staff:rules',
  ]),
  // MARKETING reads the queue but never writes the clinical or financial
  // record: view-only, no confirm, no diagnosis, no billing.
  MARKETING: new Set<StaffAction>([
    'appointment:view',
    'staff:team',
    'staff:chat',
    'staff:rules',
  ]),
};

const KNOWN_ROLES = new Set<string>([
  'ADMIN',
  'VET',
  'SPA',
  'RECEPTIONIST',
  'INTERN',
  'MARKETING',
]);

/** Normalise whatever is in staff.json / the session cookie into a StaffRole. */
export function normalizeRole(value: unknown): StaffRole | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  return KNOWN_ROLES.has(upper) ? (upper as StaffRole) : null;
}

/** True only for a role that is allowed to perform `action`. Deny by default. */
export function roleCan(role: unknown, action: StaffAction): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  return MATRIX[normalized].has(action);
}

/** Vietnamese message used by the 403 responses and mirrored in the dashboard. */
export function permissionDeniedMessage(action: StaffAction): string {
  switch (action) {
    case 'appointment:view':
      return 'Tài khoản của bạn không có quyền xem danh sách lịch hẹn.';
    case 'appointment:confirm':
      return 'Tài khoản của bạn không có quyền xác nhận lịch hẹn.';
    case 'appointment:cancel':
      return 'Tài khoản của bạn không có quyền huỷ lịch hẹn.';
    case 'diagnosis:write':
      return 'Tài khoản của bạn không có quyền ghi chẩn đoán / hướng điều trị.';
    case 'file:upload':
      return 'Tài khoản của bạn không có quyền tải file lên.';
    case 'billing:write':
      return 'Tài khoản của bạn không có quyền xuất hoá đơn / đánh dấu hoàn thành.';
    case 'staff:team':
      return 'Tài khoản của bạn không có quyền xem danh sách nhân viên.';
    case 'staff:chat':
      return 'Tài khoản của bạn không có quyền dùng chatbox nội bộ.';
    case 'staff:rules':
      return 'Tài khoản của bạn không có quyền xem nội quy tuân thủ.';
    case 'staff:grant':
      return 'Chỉ quản trị viên mới có quyền cấp tài khoản nhân viên mới.';
    default:
      return 'Tài khoản của bạn không có quyền thực hiện thao tác này.';
  }
}
