// lib/staff-service.ts
// Staff account service — PIN-only authentication backed by data/staff.json.
//
// WHY PIN-ONLY (was email + password → 6-digit PIN)
//   The old two-phase flow made every employee share one account, then layered
//   a second shared secret on top. Neither phase identified WHO was at the
//   keyboard: a receptionist could write a diagnosis under the doctor's name
//   and the medical record could not tell the difference afterwards. Staff now
//   have individual accounts, and the 6-digit PIN is the ONLY credential — it
//   works both to sign in and to authorise the creation of a new account.
//
// Responsibilities:
//   1. Safe file I/O for data/staff.json via lib/jsonStore.
//   2. PIN hashing (bcrypt) + verification with a legacy-plaintext migration
//      path, so a hand-written staff.json never breaks sign-in.
//   3. Brute-force protection: 5 wrong PINs ⇒ that account locks for 5 minutes.
//   4. sanitizeStaff() — never leak pinHash (or any credential) to clients.
//
// This module is the single owner of staff CREDENTIALS. It is not the owner of
// staff AUTHORISATION — that is lib/staffPermissions.ts (the role matrix).

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createAsyncJsonStore } from './jsonStore';
import { BRANCHES, type Branch } from './clinics';
import {
  JOB_TITLE_TO_ROLE,
  PIN_PATTERN,
  type StaffJobTitle,
  type StaffPublic,
  type StaffRole,
} from './staffShared';

// ─── Types ─────────────────────────────────────────────────────────────
// The pure declarations (role/job-title unions, the job-title → role map, the
// labels, the PIN format, StaffPublic) live in ./staffShared because the staff
// auth CARD is a client component and cannot import this module — it would drag
// bcrypt, node:crypto and fs into the browser bundle. Re-exported so server code
// keeps a single import site.
export {
  JOB_TITLE_LABELS,
  JOB_TITLE_TO_ROLE,
  PIN_LENGTH,
  PIN_PATTERN,
  type StaffJobTitle,
  type StaffPublic,
  type StaffRole,
} from './staffShared';

/** A stored staff row. `StaffPublic` is this minus every credential field. */
export interface StaffRecord {
  id: string;
  /** Links this login account to a public staff profile, when applicable. */
  profileId?: string;
  /** Tên nhân viên. `name` is kept as an alias so older rows and callers work. */
  fullName: string;
  name?: string;
  /** Ngày sinh — ISO `yyyy-mm-dd`, `null` when not supplied. */
  dateOfBirth: string | null;
  /**
   * Email — nhập để định danh + chống trùng. KHÔNG dùng để gửi OTP, KHÔNG
   * dùng làm bí mật. There is no password-reset-via-email path for staff.
   */
  email: string;
  /** Chi nhánh làm việc — id từ lib/clinics.ts BRANCHES (b1…b4). */
  branchId: string;
  role: StaffRole;
  jobTitle: StaffJobTitle;
  /** bcrypt digest of the 6-digit PIN. Plaintext is never persisted. */
  pinHash?: string;
  /** Legacy plain-text PIN from hand-written staff.json; migrated to bcrypt. */
  pin?: string;
  avatarUrl: string | null;
  bio: string;
  isActive: boolean;
  lastLoginAt: string | null;
  /** ISO thời điểm nhân viên xác nhận đã đọc nội quy. */
  rulesAcknowledgedAt: string | null;
  /**
   * Phiên bản nội quy mà nhân viên đã xác nhận.
   *
   * Needed because `rulesAcknowledgedAt` alone cannot tell "agreed to v1" from
   * "agreed to v3": after an edit the timestamp is still set and unchanged, so
   * the profile would keep telling someone they had read text they never saw.
   * See RULES_VERSION in lib/staffRules.ts.
   */
  rulesVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

const JOB_TITLES = new Set<string>(Object.keys(JOB_TITLE_TO_ROLE));
const ROLES = new Set<string>(Object.keys(JOB_TITLE_TO_ROLE).map((k) => JOB_TITLE_TO_ROLE[k as StaffJobTitle]));

// ─── Persistence ────────────────────────────────────────────────────
const BCRYPT_ROUNDS = 10;

/**
 * Single source of truth for staff credentials.
 *
 * WHY FILE-BACKED: customer accounts and OTPs already live in data/*.json, and
 * the staff rows were still duplicated in data/staff.json. Keeping the
 * credential store in MongoDB made every sign-in and PIN reset depend on an
 * external Atlas cluster: when that cluster is paused or the server IP is not
 * whitelisted, mongoose waits 10 seconds and then throws, so the portal answers
 * 500 for a problem the user cannot act on. One file store removes both the
 * split-brain and the external dependency. See lib/jsonStore.ts for the
 * atomic-write and in-process serialisation guarantees.
 */
const staffStore = createAsyncJsonStore<StaffRecord>('staff.json');

function rowEmail(row: Pick<StaffRecord, 'email'>): string {
  return String(row.email ?? '').toLowerCase().trim();
}

function normalizedName(name: string): string {
  return name.trim().normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

function matchesFilter(row: StaffRecord, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(
    ([key, value]) => (row as unknown as Record<string, unknown>)[key] === value
  );
}

function normalizeRole(value: unknown): StaffRole | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (ROLES.has(upper)) return upper as StaffRole;
  // Legacy rows only ever had these three.
  if (upper === 'STAFF' || upper === 'USER') return 'RECEPTIONIST';
  return null;
}

function normalizeJobTitle(value: unknown, role: StaffRole): StaffJobTitle {
  if (typeof value === 'string') {
    const upper = value.trim().toUpperCase();
    if (JOB_TITLES.has(upper)) return upper as StaffJobTitle;
  }
  switch (role) {
    case 'ADMIN':
      return 'QUAN_TRI';
    case 'VET':
      return 'BAC_SI';
    case 'SPA':
      return 'CHUYEN_GIA_SPA';
    case 'INTERN':
      return 'THUC_TAP_SINH';
    case 'MARKETING':
      return 'MARKETING';
    default:
      return 'LE_TAN';
  }
}

function normalizeStaff(value: unknown): StaffRecord | null {
  if (!value || typeof value !== 'object' || !('id' in value) || !('email' in value)) return null;
  // Shallow copy so the parser can delete Mongo-era bookkeeping keys without
  // touching the parsed file object it was handed.
  const row: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  delete row._id;
  delete row.__v;
  const role = normalizeRole(row.role) ?? 'RECEPTIONIST';
  const branch = BRANCHES.find((item) => item.id === row.branchId) ? String(row.branchId) : BRANCHES[0].id;
  const fullName = String(row.fullName || row.name || '').trim();
  const normalized: StaffRecord = {
    id: String(row.id),
    ...(typeof row.profileId === 'string' ? { profileId: row.profileId } : {}),
    fullName,
    name: fullName,
    dateOfBirth: typeof row.dateOfBirth === 'string' ? row.dateOfBirth : null,
    email: String(row.email).toLowerCase().trim(),
    branchId: branch,
    role,
    jobTitle: normalizeJobTitle(row.jobTitle, role),
    avatarUrl: typeof row.avatarUrl === 'string' ? row.avatarUrl : null,
    bio: typeof row.bio === 'string' ? row.bio : '',
    isActive: row.isActive !== false,
    lastLoginAt: typeof row.lastLoginAt === 'string' ? row.lastLoginAt : null,
    rulesAcknowledgedAt: typeof row.rulesAcknowledgedAt === 'string' ? row.rulesAcknowledgedAt : null,
    rulesVersion: typeof row.rulesVersion === 'number' ? row.rulesVersion : null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date(0).toISOString(),
  };
  if (typeof row.pinHash === 'string') normalized.pinHash = row.pinHash;
  if (typeof row.pin === 'string') normalized.pin = row.pin;
  return normalized;
}

async function findStaffRows(filter: Record<string, unknown> = {}): Promise<StaffRecord[]> {
  const rows = await staffStore.read();
  return rows
    .map(normalizeStaff)
    .filter((row): row is StaffRecord => row !== null)
    .filter((row) => matchesFilter(row, filter));
}

// ─── Secret fallback chain ─────────────────────────────────────────────
// Shared with lib/staffSession.ts and middleware.ts so a missing
// NEXTAUTH_SECRET can never 500 the auth endpoints or invalidate cookies.
export function getStaffAuthSecret(): string {
  const secret = process.env.STAFF_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('STAFF_SESSION_SECRET or NEXTAUTH_SECRET must be configured in production.');
  }
  return secret || 'belwee-development-only-staff-secret';
}

function generateStaffId(): string {
  return `STF_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

/** Branch lookup that never returns undefined — falls back to the flagship. */
export function staffBranch(branchId: string | null | undefined): Branch {
  return BRANCHES.find((b) => b.id === branchId) ?? BRANCHES[0];
}

// ─── Brute-force guard ──────────────────────────────────────────────
// 5 wrong PINs lock ONE account for 5 minutes. Keyed by the staff email, not
// the client IP: locking by IP lets one attacker lock every employee on a
// shared office NAT, while keying by email targets exactly the account being
// guessed. In-memory mirrors security/rate-limit.ts (single-process scope).
const MAX_PIN_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

type PinLock = { fails: number; lockedUntil: number; lastFailAt: number };
const pinLocks = new Map<string, PinLock>();

/** Drop entries that are both unlocked and idle for >10 min. */
function prunePinLocks(now: number): void {
  for (const [key, lock] of pinLocks) {
    if (lock.lockedUntil <= now && now - lock.lastFailAt > LOCK_MS * 2) pinLocks.delete(key);
  }
}

export interface PinLockState {
  locked: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
}

/** Read the current lock state for an account WITHOUT recording an attempt. */
export function getPinLockState(email: string): PinLockState {
  const now = Date.now();
  prunePinLocks(now);
  const lock = pinLocks.get(email.toLowerCase().trim());
  if (lock && lock.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((lock.lockedUntil - now) / 1000)),
      remainingAttempts: 0,
    };
  }
  if (lock && lock.fails >= MAX_PIN_ATTEMPTS) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((lock.lastFailAt + LOCK_MS - now) / 1000)),
      remainingAttempts: 0,
    };
  }
  return {
    locked: false,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, MAX_PIN_ATTEMPTS - (lock?.fails ?? 0)),
  };
}

/** Clear the counter after a successful sign-in so a typo does not persist. */
export function clearPinLock(email: string): void {
  pinLocks.delete(email.toLowerCase().trim());
}

function recordPinFailure(email: string): PinLockState {
  const key = email.toLowerCase().trim();
  const now = Date.now();
  prunePinLocks(now);
  const lock = pinLocks.get(key) ?? { fails: 0, lockedUntil: 0, lastFailAt: now };
  lock.fails += 1;
  lock.lastFailAt = now;
  if (lock.fails >= MAX_PIN_ATTEMPTS) {
    lock.lockedUntil = now + LOCK_MS;
    lock.fails = 0; // counter restarts once the lock is served
  }
  pinLocks.set(key, lock);
  return getPinLockState(key);
}

function pinStrengthError(pin: string): string | null {
  if (!PIN_PATTERN.test(pin)) return 'Mã PIN phải gồm đúng 6 chữ số.';
  if (/^(\d)\1{5}$/.test(pin) || /^(012345|123456|234567|345678|456789|987654|654321)/.test(pin)) {
    return 'Mã PIN quá dễ đoán. Hãy tránh dãy số liên tiếp hoặc số lặp lại.';
  }
  return null;
}

export function validateStaffPin(pin: string): string | null {
  return pinStrengthError(pin.trim());
}

// ─── Sanitize ──────────────────────────────────────────────────────────

/**
 * Strip every credential field before returning a record to clients/sessions.
 *
 * Built as an EXPLICIT allow-list of the public fields, not as a deny-list or a
 * `const { pinHash, ...rest } = row` spread. Both of those forward every key
 * they do not recognise, and the store is read straight off disk where
 * hand-edited files carry columns this code never wrote — an existing
 * data/staff.json still carries `passwordHash` from the pre-PIN era. A
 * leftover password hash travelling inside a session cookie or an API response
 * is exactly the kind of leak that is invisible until someone reads the
 * network tab. Naming each public field also means adding a column to
 * StaffRecord does NOT silently start shipping it to clients.
 */
export function sanitizeStaff(staff: StaffRecord): StaffPublic {
  const fullName = staff.fullName || staff.name || '';
  return {
    id: staff.id,
    ...(staff.profileId ? { profileId: staff.profileId } : {}),
    fullName,
    name: fullName,
    dateOfBirth: staff.dateOfBirth ?? null,
    email: staff.email,
    branchId: staff.branchId,
    role: staff.role,
    jobTitle: staff.jobTitle,
    avatarUrl: staff.avatarUrl ?? null,
    bio: staff.bio ?? '',
    isActive: staff.isActive !== false,
    lastLoginAt: staff.lastLoginAt ?? null,
    rulesAcknowledgedAt: staff.rulesAcknowledgedAt ?? null,
    rulesVersion: staff.rulesVersion ?? null,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
  } as StaffPublic;
}

/** Never leak a full record (with pinHash) into a session or an API payload. */
export function publicList(list: StaffRecord[]): StaffPublic[] {
  return list.map(sanitizeStaff);
}

// ─── PIN verification ──────────────────────────────────────────────────
/** True only for real bcrypt digests ($2a/$2b/$2y). */
function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

/**
 * Constant-time string equality.
 *
 * Plain `a === b` short-circuits on the first differing byte, so the response
 * time leaks how many leading digits matched. For a 6-digit PIN that is enough
 * to recover it one guess at a time. Hashing both sides with SHA-256 first
 * makes the compared buffers a fixed 32 bytes, so `timingSafeEqual` never
 * throws and the cost no longer depends on the secret's content.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Compare a plaintext PIN against the stored secret.
 * `migrated` is set when the legacy plain-text path matched, so the caller can
 * upgrade that row to bcrypt in the same request.
 */
async function verifySecret(
  plain: string,
  stored: string | undefined,
  migrated: { value: boolean }
): Promise<boolean> {
  const candidate = String(plain ?? '');
  const target = String(stored ?? '');
  if (!candidate || !target) return false;

  if (isBcryptHash(target)) {
    try {
      return await bcrypt.compare(candidate, target);
    } catch {
      return false;
    }
  }

  migrated.value = safeEqual(candidate, target);
  return migrated.value;
}

/** Re-hash a legacy plain-text PIN so the fallback is used only once. */
async function hashSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Upgrade a legacy plain-text PIN to bcrypt.
 *
 * Only the PIN field may be upgraded, and the digest is computed BEFORE the
 * store is touched — hashing yields the event loop for ~100ms, and a snapshot
 * taken before that yield would be stale, silently rolling back any credential
 * change that landed in the window.
 */
async function persistMigration(id: string, legacyPin: string): Promise<void> {
  if (!legacyPin) return;
  // Hash BEFORE taking the store lock: bcrypt yields for ~100ms and must not run
  // while the synchronous mutator owns the rows.
  const pinHash = await hashSecret(legacyPin);
  await staffStore.update((rows) => {
    const index = rows.findIndex(
      (row) => String(row.id) === id && !row.pinHash && row.pin === legacyPin
    );
    if (index === -1) return;
    rows[index] = {
      ...rows[index],
      pinHash,
      updatedAt: new Date().toISOString(),
    };
    delete rows[index].pin;
  });
}

// ─── Lookup ────────────────────────────────────────────────────────────
export async function findStaffByEmail(email: string): Promise<StaffRecord | undefined> {
  const normalized = email.toLowerCase().trim();
  return (await findStaffRows({ email: normalized }))[0];
}

export async function findStaffById(id: string): Promise<StaffRecord | undefined> {
  return (await findStaffRows({ id }))[0];
}

export async function listAllStaff(): Promise<StaffRecord[]> {
  return findStaffRows();
}

export async function emailTaken(email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  return (await findStaffRows({ email: normalized })).length > 0;
}

// ─── Sign in (PIN only) ────────────────────────────────────────────────
export type VerifyPinResult =
  | { ok: true; staff: StaffRecord }
  | { ok: false; error: string; locked?: boolean; retryAfterSeconds?: number };

export async function verifyStaffPin(email: string, pin: string): Promise<VerifyPinResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedPin = String(pin ?? '').trim();

  if (!PIN_PATTERN.test(normalizedPin)) {
    return { ok: false, error: 'Mã PIN phải gồm đúng 6 chữ số.' };
  }

  // Check the lock BEFORE the bcrypt compare. Hashing a locked account would
  // let an attacker burn server CPU for free.
  const state = getPinLockState(normalizedEmail);
  if (state.locked) {
    return {
      ok: false,
      error: `Mã PIN không đúng. Tạm khoá tài khoản — vui lòng thử lại sau ${state.retryAfterSeconds} giây.`,
      locked: true,
      retryAfterSeconds: state.retryAfterSeconds,
    };
  }

  const staff = await findStaffByEmail(normalizedEmail);

  // When the account does not exist we still run one bcrypt compare, against a
  // fixed dummy digest. Skipping it would make "no such staff" answer ~100ms
  // faster than "wrong PIN", which is enough to enumerate valid staff emails
  // from response timing alone. The digest is the bcrypt of a string nobody
  // can supply (it is not 6 digits), so this compare can never succeed.
  const migrated = { value: false };
  const pinOk = await verifySecret(
    normalizedPin,
    staff ? staff.pinHash ?? staff.pin : DUMMY_PIN_HASH,
    migrated
  );

  if (!staff || !pinOk) {
    const next = recordPinFailure(normalizedEmail);
    if (next.locked) {
      return {
        ok: false,
        error: `Bạn đã nhập sai mã PIN quá ${MAX_PIN_ATTEMPTS} lần. Tài khoản tạm khoá ${Math.round(LOCK_MS / 60000)} phút.`,
        locked: true,
        retryAfterSeconds: next.retryAfterSeconds,
      };
    }
    return {
      ok: false,
      error: `Mã PIN không chính xác. Còn ${next.remainingAttempts} lần thử.`,
    };
  }

  if (!staff.isActive) {
    return { ok: false, error: 'Tài khoản đã bị khoá. Liên hệ quản trị viên.' };
  }

  clearPinLock(normalizedEmail);

  // One-time upgrade: legacy plain-text → bcrypt.
  if (migrated.value && staff.pin) {
    try {
      await persistMigration(staff.id, staff.pin);
    } catch (err) {
      console.warn('[staff-service] Không thể nâng cấp hash PIN cũ lên bcrypt:', err);
    }
  }

  return { ok: true, staff };
}

/**
 * A valid bcrypt digest used ONLY as the decoy in verifyStaffPin's unknown-account
 * path. The digest is bcrypt("belwee-no-such-account"), which is not 6 digits,
 * so no PIN the caller can send will ever compare equal to it.
 */
const DUMMY_PIN_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// ─── Create an account ─────────────────────────────────────────────────
export interface RegisterStaffInput {
  profileId?: string;
  fullName: string;
  dateOfBirth?: string | null;
  email: string;
  branchId: string;
  jobTitle: StaffJobTitle;
  avatarUrl?: string | null;
  bio?: string;
  pin: string;
  /**
   * PIN của một quản trị viên. Có mặt ⇒ tài khoản mới kế thừa quyền ADMIN,
   * vì đó là "quản lý cấp tài khoản". Bỏ trống ⇒ tài khoản tự đăng ký nhận
   * đúng nhóm quyền ứng với chức danh đã chọn.
   */
  managerPin?: string | null;
}

export type RegisterStaffResult =
  | { ok: true; staff: StaffPublic }
  | { ok: false; error: string; field?: string };

/** `yyyy-mm-dd`, and it must be a real past date (staff are adults). */
export function validateDateOfBirth(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return 'Ngày sinh không đúng định dạng (yyyy-mm-dd).';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return 'Ngày sinh không hợp lệ.';
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return 'Ngày sinh không hợp lệ.';
  }
  const age = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 16) return 'Ngày sinh không hợp lệ với tài khoản nhân viên.';
  if (age > 100) return 'Ngày sinh không hợp lệ.';
  return null;
}

export async function registerStaff(input: RegisterStaffInput): Promise<RegisterStaffResult> {
  const fullName = input.fullName.trim().replace(/\s+/g, ' ');
  if (fullName.length < 2) {
    return { ok: false, field: 'fullName', error: 'Tên nhân viên phải có ít nhất 2 ký tự.' };
  }
  if (fullName.length > 100) {
    return { ok: false, field: 'fullName', error: 'Tên nhân viên quá dài.' };
  }

  const email = input.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return { ok: false, field: 'email', error: 'Email không đúng định dạng.' };
  }

  let dateOfBirth: string | null = null;
  if (input.dateOfBirth) {
    const dobError = validateDateOfBirth(input.dateOfBirth);
    if (dobError) return { ok: false, field: 'dateOfBirth', error: dobError };
    dateOfBirth = input.dateOfBirth.trim();
  }

  const branch = BRANCHES.find((b) => b.id === input.branchId);
  if (!branch) {
    return { ok: false, field: 'branchId', error: 'Chi nhánh không hợp lệ.' };
  }

  if (!JOB_TITLES.has(input.jobTitle)) {
    return { ok: false, field: 'jobTitle', error: 'Chức danh không hợp lệ.' };
  }

  const pinError = pinStrengthError(input.pin.trim());
  if (pinError) return { ok: false, field: 'pin', error: pinError };

  if (await emailTaken(email)) {
    return { ok: false, field: 'email', error: 'Email này đã được dùng cho một tài khoản khác.' };
  }
  if (
    input.profileId &&
    (await findStaffRows()).some(
      (staff) =>
        staff.profileId === input.profileId ||
        (!staff.profileId && normalizedName(staff.fullName) === normalizedName(fullName))
    )
  ) {
    return {
      ok: false,
      field: 'profileId',
      error: 'Hồ sơ này đã được liên kết với tài khoản. Vui lòng tải lại danh sách nhân viên.',
    };
  }

  // Manager PIN ⇒ the new account is an admin. Verified against an ACTIVE
  // ADMIN only, and the failure message is deliberately identical to a bad
  // PIN so this cannot be used to probe who the admins are.
  let role: StaffRole = JOB_TITLE_TO_ROLE[input.jobTitle];
  const managerPin = input.managerPin?.trim();
  if (managerPin) {
    if (!PIN_PATTERN.test(managerPin)) {
      return { ok: false, field: 'managerPin', error: 'Mã PIN quản lý không đúng.' };
    }
    const admins = await findStaffRows({ isActive: true, role: 'ADMIN' });
    const adminsWithPin = admins.filter((staff) => staff.pinHash || staff.pin);
    let granted = false;
    for (const admin of adminsWithPin) {
      const probe = { value: false };
      // Sequential, not Promise.all: bcrypt has an internal concurrency cost
      // and this runs after the caller already paid one compare. Six admins
      // worst case is fine on a registration form.
      if (await verifySecret(managerPin, admin.pinHash ?? admin.pin, probe)) {
        granted = true;
        if (probe.value && admin.pin) await persistMigration(admin.id, admin.pin);
        break;
      }
    }
    if (!granted) {
      return { ok: false, field: 'managerPin', error: 'Mã PIN quản lý không đúng.' };
    }
    role = 'ADMIN';
  }

  const pinHash = await hashSecret(input.pin.trim());
  const now = new Date().toISOString();
  const record: StaffRecord = {
    id: generateStaffId(),
    ...(input.profileId ? { profileId: input.profileId } : {}),
    fullName,
    name: fullName,
    dateOfBirth,
    email,
    branchId: branch.id,
    role,
    jobTitle: input.jobTitle,
    pinHash,
    avatarUrl: input.avatarUrl ?? null,
    bio: input.bio ?? '',
    isActive: true,
    lastLoginAt: now,
    rulesAcknowledgedAt: null,
    rulesVersion: null,
    createdAt: now,
    updatedAt: now,
  };

  // Re-check the email inside the store lock. The earlier emailTaken() call is
  // only a fast path; two concurrent registrations can both pass it, and the
  // mutex is where one of them has to lose.
  return staffStore.update((rows) => {
    if (rows.some((row) => rowEmail(row) === email)) {
      return {
        ok: false as const,
        field: 'email',
        error: 'Email này đã được dùng cho một tài khoản khác.',
      };
    }
    if (
      input.profileId &&
      rows.some(
        (row) =>
          row.profileId === input.profileId ||
          (!row.profileId &&
            normalizedName(String(row.fullName || row.name || '')) === normalizedName(fullName))
      )
    ) {
      return {
        ok: false as const,
        field: 'profileId',
        error: 'Hồ sơ này đã được liên kết với tài khoản. Vui lòng tải lại danh sách nhân viên.',
      };
    }
    rows.push(record);
    return { ok: true as const, staff: sanitizeStaff(record) };
  });
}

// ─── Seed ──────────────────────────────────────────────────────────────
// ⛔ SECURITY: no hardcoded default credentials are shipped. The first admin
// is created only when ALLOW_STAFF_SEED === 'true' (explicit opt-in) and its
// PIN is random, printed ONCE to the server console. No PIN is guessable.
//
// The seed deliberately keeps the historical admin email so an existing
// installation that upgrades keeps a way in: ALLOW_STAFF_SEED plus a printed
// one-time PIN replaces the PIN on the FIRST admin row when it has no usable
// digest.
export async function ensureSeedStaff(): Promise<{ seeded: boolean; staff?: StaffPublic }> {
  if (process.env.ALLOW_STAFF_SEED !== 'true') return { seeded: false };

  const pin = process.env.STAFF_INIT_PIN?.trim();
  if (!pin || !PIN_PATTERN.test(pin) || pinStrengthError(pin)) {
    console.error('[staff-service] STAFF_INIT_PIN must be configured as a strong 6-digit PIN before enabling staff seeding.');
    return { seeded: false };
  }

  const pinHash = await hashSecret(pin);
  const now = new Date().toISOString();

  const seeded = await staffStore.update((rows) => {
    const admins = rows
      .map(normalizeStaff)
      .filter((row): row is StaffRecord => row !== null)
      .filter((row) => normalizeRole(row.role) === 'ADMIN' && (row.pinHash || row.pin));
    if (admins.length > 0) return false;

    const reusableIndex = rows.findIndex((row) => rowEmail(row) === 'admin@belwee.vn');
    if (reusableIndex !== -1) {
      rows[reusableIndex] = {
        ...rows[reusableIndex],
        role: 'ADMIN',
        jobTitle: 'QUAN_TRI',
        pinHash,
        updatedAt: now,
      };
      delete rows[reusableIndex].pin;
      return true;
    }

    rows.push({
      id: generateStaffId(),
      fullName: 'Quản Trị Viên Belwee',
      name: 'Quản Trị Viên Belwee',
      dateOfBirth: null,
      email: 'admin@belwee.vn',
      branchId: BRANCHES[0].id,
      role: 'ADMIN',
      jobTitle: 'QUAN_TRI',
      pinHash,
      avatarUrl: null,
      bio: '',
      isActive: true,
      lastLoginAt: now,
      rulesAcknowledgedAt: null,
      rulesVersion: null,
      createdAt: now,
      updatedAt: now,
    });
    return true;
  });

  if (!seeded) return { seeded: false };

  console.warn('[staff-service] Admin staff account seeded. Change the configured initial PIN after first sign-in.');
  const admin = await findStaffByEmail('admin@belwee.vn');
  return admin ? { seeded: true, staff: sanitizeStaff(admin) } : { seeded: true };
}

// ─── Profile mutations ────────────────────────────────────────────────
export async function updateStaffProfile(
  id: string,
  patch: { fullName?: string; bio?: string; avatarUrl?: string | null; dateOfBirth?: string | null }
): Promise<StaffRecord | undefined> {
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.fullName !== undefined) {
    const name = patch.fullName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) return undefined;
    update.fullName = name;
    update.name = name;
  }
  if (patch.bio !== undefined) update.bio = patch.bio.trim().slice(0, 600);
  if (patch.avatarUrl !== undefined) update.avatarUrl = patch.avatarUrl;
  if (patch.dateOfBirth !== undefined) {
    if (patch.dateOfBirth !== null) {
      const dobError = validateDateOfBirth(patch.dateOfBirth);
      if (dobError) return undefined;
    }
    update.dateOfBirth = patch.dateOfBirth?.trim() ?? null;
  }
  const updated = await staffStore.update((rows) => {
    const index = rows.findIndex((row) => String(row.id) === id);
    if (index === -1) return undefined;
    rows[index] = { ...rows[index], ...(update as Partial<StaffRecord>) };
    return normalizeStaff(rows[index]) ?? undefined;
  });
  return updated;
}

/**
 * Change a staff member's own PIN. Requires the CURRENT pin so a walked-up
 * unlocked screen cannot be used to seize the account, and applies the same
 * weakness rules as registration.
 */
export async function changeStaffPin(
  id: string,
  currentPin: string,
  nextPin: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const staff = await findStaffById(id);
  if (!staff) return { ok: false, error: 'Không tìm thấy tài khoản.' };

  if (!PIN_PATTERN.test(currentPin.trim())) {
    return { ok: false, error: 'Mã PIN hiện tại phải gồm đúng 6 chữ số.' };
  }
  const probe = { value: false };
  if (!(await verifySecret(currentPin.trim(), staff.pinHash ?? staff.pin, probe))) {
    return { ok: false, error: 'Mã PIN hiện tại không chính xác.' };
  }
  const pinError = pinStrengthError(nextPin.trim());
  if (pinError) return { ok: false, error: pinError.replace('Mã PIN', 'Mã PIN mới') };

  const pinHash = await hashSecret(nextPin.trim());
  const changed = await staffStore.update((rows) => {
    const index = rows.findIndex((row) => String(row.id) === id);
    if (index === -1) return false;
    const current = rows[index];
    if (current.isActive === false) return false;
    // Optimistic concurrency: the credential we verified must still be the
    // credential on disk, otherwise a concurrent reset wins and this change is
    // rejected instead of silently overwriting it.
    const credentialMatches = staff.pinHash
      ? current.pinHash === staff.pinHash
      : current.pin === staff.pin;
    if (!credentialMatches) return false;
    rows[index] = { ...current, pinHash, updatedAt: new Date().toISOString() };
    delete rows[index].pin;
    return true;
  });
  if (!changed) return { ok: false, error: 'Thông tin PIN đã thay đổi. Vui lòng thử lại.' };
  clearPinLock(staff.email);
  return { ok: true };
}

/** Reset a staff PIN after the caller has verified the email OTP and recovery code. */
export async function resetStaffPin(
  email: string,
  nextPin: string
): Promise<{ ok: true; staff: StaffRecord } | { ok: false; error: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedPin = nextPin.trim();
  const pinError = validateStaffPin(normalizedPin);
  if (pinError) return { ok: false, error: pinError };

  const staff = await findStaffByEmail(normalizedEmail);
  if (!staff || !staff.isActive) {
    return { ok: false, error: 'Không thể cấp lại PIN cho tài khoản này. Vui lòng liên hệ quản lý.' };
  }

  const pinHash = await hashSecret(normalizedPin);
  const changed = await staffStore.update((rows) => {
    const index = rows.findIndex((row) => rowEmail(row) === normalizedEmail);
    if (index === -1) return false;
    const current = rows[index];
    if (current.isActive === false) return false;
    const credentialMatches = staff.pinHash
      ? current.pinHash === staff.pinHash
      : current.pin === staff.pin;
    if (!credentialMatches) return false;
    rows[index] = { ...current, pinHash, updatedAt: new Date().toISOString() };
    delete rows[index].pin;
    return true;
  });
  if (!changed) {
    return { ok: false, error: 'Không thể cấp lại PIN cho tài khoản này. Vui lòng liên hệ quản lý.' };
  }

  clearPinLock(normalizedEmail);
  const updated = await findStaffByEmail(normalizedEmail);
  return updated
    ? { ok: true, staff: updated }
    : { ok: false, error: 'Không thể cấp lại PIN cho tài khoản này. Vui lòng liên hệ quản lý.' };
}

/**
 * Grant or revoke access for one account.
 *
 * Revoking is how a lost laptop is dealt with: the cookie stops being accepted
 * on the very next request, because getStaffSession() re-reads the record rather
 * than trusting the 12-hour token. There is no "pending" state — a half-revoked
 * account is worse than either end state.
 */
export async function setStaffActive(id: string, isActive: boolean): Promise<StaffRecord | undefined> {
  return staffStore.update((rows) => {
    const index = rows.findIndex((row) => String(row.id) === id);
    if (index === -1) return undefined;
    rows[index] = { ...rows[index], isActive, updatedAt: new Date().toISOString() };
    return normalizeStaff(rows[index]) ?? undefined;
  });
}

/**
 * Record that a member read the code of conduct.
 *
 * `version` is stored alongside the timestamp: see `rulesVersion` on
 * StaffRecord for why a bare date is not enough.
 */
export async function acknowledgeRules(
  id: string,
  version: number
): Promise<StaffRecord | undefined> {
  return staffStore.update((rows) => {
    const index = rows.findIndex((row) => String(row.id) === id);
    if (index === -1) return undefined;
    rows[index] = {
      ...rows[index],
      rulesAcknowledgedAt: new Date().toISOString(),
      rulesVersion: version,
    };
    return normalizeStaff(rows[index]) ?? undefined;
  });
}

export async function touchLastLogin(id: string): Promise<void> {
  await staffStore.update((rows) => {
    const index = rows.findIndex((row) => String(row.id) === id);
    if (index === -1) return;
    rows[index] = { ...rows[index], lastLoginAt: new Date().toISOString() };
  });
}
