/**
 * scripts/verify-staff-auth.ts
 * Proves the staff auth invariants that are easy to break and impossible to
 * eyeball: no credential ever reaches a public record, a wrong PIN locks the
 * account, a right PIN does not, and self-registration grants exactly the
 * permissions of the chosen chức danh.
 *
 * Run with: npx tsx scripts/verify-staff-auth.ts
 *
 * It writes to data/staff.json — the real store — so it backs up and restores
 * the file around the test. That is deliberate: testing against a mock store
 * would not exercise the actual normalizer, which is where the credential leak
 * actually lived.
 */

// Nạp `.env.local` trước mọi import khác. Trong ESM mọi import được đánh giá
// trước câu lệnh thường, nên nếu module nào đọc `process.env` ở cấp module thì
// nó phải thấy biến môi trường đã có giá trị. `lib/staff-service` không còn phụ
// thuộc Mongo, nhưng giữ thứ tự này để script chạy giống môi trường thật.
import './load-env';

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  sanitizeStaff,
  registerStaff,
  verifyStaffPin,
  listAllStaff,
  getPinLockState,
  clearPinLock,
  setStaffActive,
  resetStaffPin,
} from '../lib/staff-service';
import { roleCan, type StaffAction } from '../lib/staffPermissions';
import { toStaffAppointment } from '../lib/staffAppointments';
import { toConfirmedBy } from '../lib/staffAppointments';
import type { Booking } from '../lib/dbBooking';

const DATA_DIR = path.join(process.cwd(), 'data');
const STAFF_FILE = path.join(DATA_DIR, 'staff.json');

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ─── 1. sanitizeStaff never leaks a credential ────────────────────────
console.log('\n1. Credential containment');

// Shaped like a legacy staff.json row: it still carries `passwordHash`, which
// is exactly what a hand-edited or pre-migration file looks like.
const legacyRow = {
  id: 'STF_TEST_LEAK',
  fullName: 'Test',
  name: 'Test',
  dateOfBirth: null,
  email: 'leak@belwee.vn',
  branchId: 'b1',
  role: 'ADMIN',
  jobTitle: 'QUAN_TRI',
  pinHash: bcrypt.hashSync('123456', 4),
  pin: '123456',
  // Fields the CURRENT code never writes, but a hand-edited file may contain.
  passwordHash: 'super-secret-legacy-hash',
  password: 'plaintext-legacy-password',
  sessionToken: 'leaked-session',
  internalNotes: 'private',
  avatarUrl: null,
  bio: '',
  isActive: true,
  lastLoginAt: null,
  rulesAcknowledgedAt: null,
  rulesVersion: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as Parameters<typeof sanitizeStaff>[0];

const publicRecord = sanitizeStaff(legacyRow);
const serialised = JSON.stringify(publicRecord);

check('pinHash absent', !('pinHash' in publicRecord));
check('legacy passwordHash absent', !('passwordHash' in publicRecord));
check('legacy plaintext password absent', !('password' in publicRecord));
check('unknown sessionToken absent', !('sessionToken' in publicRecord));
check('unknown internalNotes absent', !('internalNotes' in publicRecord));
check('legacy hash value never appears in the serialised record',
  !serialised.includes('super-secret-legacy-hash') && !serialised.includes('plaintext-legacy-password'));
check('name alias matches fullName', publicRecord.name === publicRecord.fullName);

// ─── 2. The RBAC matrix denies by default ─────────────────────────────
console.log('\n2. Role matrix');

const matrix: Array<[string, StaffAction, boolean]> = [
  ['ADMIN', 'staff:grant', true],
  ['VET', 'staff:grant', false],
  ['SPA', 'staff:grant', false],
  ['RECEPTIONIST', 'staff:grant', false],
  ['INTERN', 'staff:grant', false],
  ['MARKETING', 'staff:grant', false],
  ['RECEPTIONIST', 'diagnosis:write', false],
  ['VET', 'diagnosis:write', true],
  ['SPA', 'diagnosis:write', true],
  ['INTERN', 'diagnosis:write', false],
  ['MARKETING', 'diagnosis:write', false],
  ['MARKETING', 'appointment:view', true],
  ['INTERN', 'appointment:view', true],
  ['VET', 'appointment:cancel', false],
  ['RECEPTIONIST', 'appointment:cancel', true],
];
for (const [role, action, expected] of matrix) {
  check(`${role} ${action} = ${expected}`, roleCan(role, action) === expected);
}
check('unknown role denied everything', roleCan('SUPERUSER', 'appointment:view') === false);
check('undefined role denied', roleCan(undefined, 'appointment:confirm') === false);
check('lowercase role normalised', roleCan('vet', 'diagnosis:write') === true);

// ─── 3. toConfirmedBy is total ────────────────────────────────────────
console.log('\n3. Confirmed-by attribution');
check('null staff → null', toConfirmedBy(null) === null);
check('undefined staff → null', toConfirmedBy(undefined) === null);
check(
  'triple is built from name + avatar',
  JSON.stringify(toConfirmedBy({ id: 'S1', name: 'BS. Vũ', avatarUrl: '/a.png' })) ===
    JSON.stringify({ staffId: 'S1', name: 'BS. Vũ', avatarUrl: '/a.png' })
);
// avatarUrl is required-but-nullable on the input, so the "absent" case is null
// rather than undefined; both must land as null in the stored triple.
check('null avatar preserved', toConfirmedBy({ id: 'S1', name: 'BS. Vũ', avatarUrl: null })?.avatarUrl === null);

// ─── 4. StaffAppointment exposes the confirmer ────────────────────────
console.log('\n4. Appointment view model');
const booking = {
  id: 'BW_TEST',
  customerEmail: 'a@b.vn',
  customerName: 'Chủ',
  customerPhone: '0900000000',
  petName: 'Mít',
  petType: 'Chó',
  serviceType: 'Khám',
  time: '2026-10-10 09:00',
  status: 'CONFIRMED',
  confirmToken: null,
  confirmedAt: '2026-10-09T10:00:00.000Z',
  confirmedBy: { staffId: 'S1', name: 'BS. Vũ', avatarUrl: null },
  createdAt: '2026-10-08T10:00:00.000Z',
} as Booking;

const appt = toStaffAppointment(booking, null);
check('confirmedBy reaches the dashboard shape', appt.confirmedBy?.name === 'BS. Vũ');
const noConfirmer = toStaffAppointment({ ...booking, confirmedBy: null }, null);
check('missing confirmedBy → null (not undefined)', noConfirmer.confirmedBy === null);

// ─── 5. Live store: lockout + self-registration ───────────────────────
// `lib/staff-service` writes to data/staff.json — the real store. The live
// checks below therefore back the file up first and restore it in `finally`, so
// a run leaves the customer's staff accounts exactly as it found them. Testing
// against a mock would skip the normalizer and the store mutex, which is where
// the credential leak and the lost-update bugs actually lived.
const backup = fs.existsSync(STAFF_FILE) ? fs.readFileSync(STAFF_FILE, 'utf-8') : null;

async function runLiveChecks() {
  console.log('\n5. Brute-force lockout (live store)');

  const email = 'lockout-test@belwee.vn';
  const pin = '918273';

  // Weak PINs are rejected before any hash is computed.
  const weak = await registerStaff({
    fullName: 'Lockout Test',
    dateOfBirth: '1995-05-05',
    email,
    branchId: 'b1',
    jobTitle: 'LE_TAN',
    pin: '111111',
    managerPin: null,
  });
  check('repeated-digit PIN rejected', !weak.ok && weak.field === 'pin');

  const sequential = await registerStaff({
    fullName: 'Lockout Test',
    dateOfBirth: '1995-05-05',
    email,
    branchId: 'b1',
    jobTitle: 'LE_TAN',
    pin: '123456',
    managerPin: null,
  });
  check('sequential PIN rejected', !sequential.ok && sequential.field === 'pin');

  const created = await registerStaff({
    fullName: 'Lockout Test',
    dateOfBirth: '1995-05-05',
    email,
    branchId: 'b1',
    jobTitle: 'LE_TAN',
    pin,
    managerPin: null,
  });
  check('self-registration succeeds', created.ok);
  check('lễ tân registration gets RECEPTIONIST', created.ok && created.staff.role === 'RECEPTIONIST');
  check('registration response carries no pinHash',
    created.ok && !JSON.stringify(created.staff).includes('pinHash'));

  const duplicate = await registerStaff({
    fullName: 'Lockout Test 2',
    dateOfBirth: '1995-05-05',
    email,
    branchId: 'b1',
    jobTitle: 'LE_TAN',
    pin,
    managerPin: null,
  });
  check('duplicate email rejected', !duplicate.ok && duplicate.field === 'email');

  // Wrong PINs: 5 failures must lock the account.
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await verifyStaffPin(email, '000000');
    if (attempt < 5) {
      check(`wrong PIN #${attempt} reports remaining attempts`, !result.ok && !result.locked);
    } else {
      check('wrong PIN #5 locks the account', !result.ok && result.locked === true);
    }
  }

  // Even the CORRECT pin must now be refused while the lock stands. This is the
  // property that matters: without it, an attacker who knows the PIN would just
  // wait out the five failures and then sign in.
  const lockedBefore = getPinLockState(email);
  check('lock is active after the 5th failure', lockedBefore.locked === true);
  const duringLock = await verifyStaffPin(email, pin);
  check('correct PIN refused while locked', !duringLock.ok && duringLock.locked === true);
  check(
    'lock reports a retry-after',
    !duringLock.ok && (duringLock.retryAfterSeconds ?? 0) > 0,
    `got ${duringLock.ok ? 'ok' : String(duringLock.retryAfterSeconds)}`
  );

  // Clearing the lock (what a successful sign-in does) restores access —
  // proving the refusal above was the LOCK, not a broken credential check.
  clearPinLock(email);
  check('clearPinLock releases the lock', getPinLockState(email).locked === false);
  const afterClear = await verifyStaffPin(email, pin);
  check('correct PIN accepted once unlocked', afterClear.ok === true);

  const reset = await resetStaffPin(email, '293847');
  check('reset PIN accepts a valid new PIN', reset.ok);
  const oldAfterReset = await verifyStaffPin(email, pin);
  check('old PIN rejected after reset', !oldAfterReset.ok);
  const newAfterReset = await verifyStaffPin(email, '293847');
  check('new PIN works after reset', newAfterReset.ok);

  console.log('\n6. Weak-password gate + revoke');
  const shortPin = await registerStaff({
    fullName: 'Short Pin',
    dateOfBirth: '1995-05-05',
    email: 'short-pin@belwee.vn',
    branchId: 'b1',
    jobTitle: 'BAC_SI',
    pin: '123',
    managerPin: null,
  });
  check('3-digit PIN rejected', !shortPin.ok && shortPin.field === 'pin');

  if (created.ok) {
    const revoked = await setStaffActive(created.staff.id, false);
    check('setStaffActive(false) works', revoked?.isActive === false);
    const afterRevoke = await verifyStaffPin(email, pin);
    check('revoked account cannot sign in', !afterRevoke.ok);
  }

  // ─── 7. Manager PIN gating ──────────────────────────────────────────
  console.log('\n7. Manager PIN');
  const noManager = await registerStaff({
    fullName: 'Receptionist Two',
    dateOfBirth: '1990-01-01',
    email: 'rec2@belwee.vn',
    branchId: 'b2',
    jobTitle: 'RECEPTIONIST' as never,
    pin: '456789',
    managerPin: null,
  });
  check('chức danh lạ bị từ chối', !noManager.ok && noManager.field === 'jobTitle');

  const wrongManager = await registerStaff({
    fullName: 'Escalation Attempt',
    dateOfBirth: '1990-01-01',
    email: 'esc@belwee.vn',
    branchId: 'b2',
    jobTitle: 'LE_TAN',
    pin: '445566',
    managerPin: '000000',
  });
  check('wrong manager PIN does NOT grant admin',
    !wrongManager.ok || wrongManager.staff.role !== 'ADMIN');

  // Clean up the rows this test created.
  const rows = await listAllStaff();
  console.log(`\n(info) staff rows during test: ${rows.length}`);
}

// The store is now the plain file `data/staff.json`. Writing to it is safe for
// this script because the file is backed up before any live check runs and
// restored byte-for-byte afterwards, in `finally`, even if a check throws.
runLiveChecks()
  .catch((err) => {
    failed += 1;
    console.error('\nLive checks threw:', err);
  })
  .finally(() => {
    // Restore data/staff.json exactly as it was found.
    if (backup !== null) {
      fs.writeFileSync(STAFF_FILE, backup, 'utf-8');
      console.log('\n(info) data/staff.json restored from backup.');
    } else if (fs.existsSync(STAFF_FILE)) {
      fs.unlinkSync(STAFF_FILE);
      console.log('\n(info) data/staff.json removed (did not exist before).');
    }

    console.log(`\nstaff-auth: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
