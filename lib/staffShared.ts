/**
 * lib/staffShared.ts
 * The staff model constants that are safe to import from a CLIENT component.
 *
 * WHY THIS FILE IS SPLIT OUT
 *   lib/staff-service.ts is the credential owner: it imports bcrypt, node:crypto
 *   and lib/jsonStore (which imports fs). A "use client" component that imports
 *   anything from it pulls all of that into the browser bundle and the build
 *   fails with "Module not found: Can't resolve 'fs'".
 *
 *   So the pure declarations — the role/job-title unions, the job-title → role
 *   map, the Vietnamese labels, and the PIN format — live here, and
 *   staff-service imports FROM here. One definition, two consumers, no
 *   duplication, and no server code in the browser bundle.
 *
 * This file must stay dependency-free apart from `import type`.
 */

// ─── Permission groups ─────────────────────────────────────────────────
// These are the axis lib/staffPermissions.ts keys on. Values are persisted in
// data/staff.json, so a rename is a breaking data migration — the matrix denies
// by default and a renamed role silently loses every permission.
export type StaffRole = 'ADMIN' | 'VET' | 'SPA' | 'RECEPTIONIST' | 'INTERN' | 'MARKETING';

/** Chức danh — the display title, several of which share a permission group. */
export type StaffJobTitle =
  | 'BAC_SI'
  | 'CHUYEN_GIA_SPA'
  | 'THUC_TAP_SINH'
  | 'MARKETING'
  | 'LE_TAN'
  | 'QUAN_TRI';

/** Job title → permission group, used when a new account registers itself. */
export const JOB_TITLE_TO_ROLE: Record<StaffJobTitle, StaffRole> = {
  QUAN_TRI: 'ADMIN',
  BAC_SI: 'VET',
  CHUYEN_GIA_SPA: 'SPA',
  LE_TAN: 'RECEPTIONIST',
  THUC_TAP_SINH: 'INTERN',
  MARKETING: 'MARKETING',
};

/** Vietnamese display label for each job title. */
export const JOB_TITLE_LABELS: Record<StaffJobTitle, string> = {
  QUAN_TRI: 'Quản trị viên',
  BAC_SI: 'Bác sĩ thú y',
  CHUYEN_GIA_SPA: 'Chuyên gia thú y spa & grooming',
  LE_TAN: 'Lễ tân',
  THUC_TAP_SINH: 'Thực tập sinh',
  MARKETING: 'Marketing',
};

/** 6-digit staff PIN. */
export const PIN_LENGTH = 6;
export const PIN_PATTERN = /^\d{6}$/;

/**
 * Which face of the staff auth card to show.
 *
 * WHY AN `enum` AND NOT AN INLINE CONSTANT IN THE COMPONENT
 *   `AuthMode` used to be declared as `export enum` inside
 *   components/staff/StaffAuthCard.tsx — a "use client" file. Both
 *   app/staff/login/page.tsx and app/staff/register/page.tsx are SERVER
 *   components and did `import StaffAuthCard, { AuthMode } from '...'`.
 *
 *   A TypeScript `enum` compiles to a runtime object, so that made `AuthMode` a
 *   non-component runtime export of a client module. When a server component
 *   reaches for it, the RSC bundler tries to resolve it as a client reference and
 *   the React Client Manifest has no entry for it:
 *
 *     Could not find the module ".../StaffAuthCard.tsx#AuthMode#Login"
 *     in the React Client Manifest. This is probably a bug of the
 *     React Server Components bundler.
 *
 *   The page still returned HTTP 200 — with a broken RSC payload, and the error
 *   repeated in the server log on every render of /staff/login.
 *
 *   Client modules may only export *components* to server components. A plain
 *   shared module (this file) has no such restriction, which is why the constant
 *   lives here now.
 */
export enum AuthMode {
  Login = 'login',
  Register = 'register',
}

/** All job titles, for rendering a select without importing the map's keys. */
export const STAFF_JOB_TITLES = Object.keys(JOB_TITLE_LABELS) as StaffJobTitle[];

/** The public shape of a staff member — never any credential field. */
export interface StaffPublic {
  id: string;
  profileId?: string;
  /** Tên nhân viên. `name` is a kept alias so older callers keep working. */
  fullName: string;
  name: string;
  dateOfBirth: string | null;
  email: string;
  branchId: string;
  role: StaffRole;
  jobTitle: StaffJobTitle;
  avatarUrl: string | null;
  bio: string;
  isActive: boolean;
  lastLoginAt: string | null;
  /** ISO thời điểm nhân viên xác nhận đã đọc nội quy. */
  rulesAcknowledgedAt: string | null;
  /** Phiên bản nội quy đã xác nhận — see lib/staffRules.ts. */
  rulesVersion: number | null;
  createdAt: string;
  updatedAt: string;
}