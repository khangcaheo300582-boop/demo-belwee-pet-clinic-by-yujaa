// lib/validators.ts
// Centralized input validation with regex patterns

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const PHONE_VN_REGEX = /^(0[3-9])[0-9]{8}$/;
const PASSWORD_MIN_LENGTH = 8;

export interface ValidationError {
  field: string;
  message: string;
}

export function validateEmail(email: string): ValidationError | null {
  if (!email || typeof email !== 'string') {
    return { field: 'email', message: 'Email không được để trống.' };
  }
  const normalized = email.toLowerCase().trim();
  if (!EMAIL_REGEX.test(normalized)) {
    return { field: 'email', message: 'Email không đúng định dạng.' };
  }
  if (normalized.length > 254) {
    return { field: 'email', message: 'Email quá dài.' };
  }
  return null;
}

export function validatePassword(password: string): ValidationError | null {
  if (!password || typeof password !== 'string') {
    return { field: 'password', message: 'Mật khẩu không được để trống.' };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { field: 'password', message: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.` };
  }
  if (password.length > 128) {
    return { field: 'password', message: 'Mật khẩu quá dài (tối đa 128 ký tự).' };
  }
  if (!/[A-Z]/.test(password)) {
    return { field: 'password', message: 'Mật khẩu phải chứa ít nhất một chữ hoa.' };
  }
  if (!/[a-z]/.test(password)) {
    return { field: 'password', message: 'Mật khẩu phải chứa ít nhất một chữ thường.' };
  }
  if (!/[0-9]/.test(password)) {
    return { field: 'password', message: 'Mật khẩu phải chứa ít nhất một chữ số.' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { field: 'password', message: 'Mật khẩu phải chứa ít nhất một ký tự đặc biệt.' };
  }
  return null;
}

export function validateName(name: string): ValidationError | null {
  if (!name || typeof name !== 'string') {
    return { field: 'name', message: 'Họ tên không được để trống.' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { field: 'name', message: 'Họ tên phải có ít nhất 2 ký tự.' };
  }
  if (trimmed.length > 100) {
    return { field: 'name', message: 'Họ tên quá dài.' };
  }
  return null;
}

export function validatePhone(phone: string): ValidationError | null {
  if (!phone || typeof phone !== 'string') {
    return { field: 'phone', message: 'Số điện thoại không được để trống.' };
  }
  const trimmed = phone.trim();
  if (!PHONE_VN_REGEX.test(trimmed)) {
    return { field: 'phone', message: 'Số điện thoại không đúng định dạng Việt Nam (bắt đầu bằng 0, 10 số).' };
  }
  return null;
}

export function validateOtpCode(code: string): ValidationError | null {
  if (!code || typeof code !== 'string') {
    return { field: 'otpCode', message: 'Mã OTP không được để trống.' };
  }
  if (!/^\d{6}$/.test(code.trim())) {
    return { field: 'otpCode', message: 'Mã OTP phải gồm đúng 6 chữ số.' };
  }
  return null;
}

export function validateRequired(value: string, field: string): ValidationError | null {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    return { field, message: `${field} không được để trống.` };
  }
  return null;
}

/**
 * Read and parse a JSON request body, distinguishing a MALFORMED body from a
 * genuinely missing one.
 *
 * `Request.json()` rejects on both an empty body and invalid syntax, and it
 * throws a raw `SyntaxError`. A route that calls it inside a bare `try { … }
 * catch { return 500 }` therefore answers a *client* mistake with a server
 * error: a truncated request or a stray non-JSON payload produced "Lỗi server"
 * and a 500 in the logs, which sends the reader looking for a server fault that
 * does not exist. The correct answer is 400.
 *
 * Handing the parse back as a tagged result keeps the distinction at the call
 * site explicit and stops each route from re-deriving it:
 *   - `{ ok: false }`  → malformed/absent JSON → respond 400
 *   - `{ ok: true, … }` → a body worth validating field by field
 *
 * Always narrow with `result.ok` before touching `data`.
 */
export async function readJsonBody<T = unknown>(
  request: Request
): Promise<
  | { ok: true; data: T }
  | { ok: false; message: string }
> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, message: 'Không đọc được nội dung yêu cầu.' };
  }

  // An empty body is the common case for a caller that only wanted a token in
  // the query string. Distinguishing it lets the route answer the precise
  // reason instead of blaming the payload's syntax.
  if (!raw || raw.trim().length === 0) {
    return { ok: false, message: 'Thiếu nội dung yêu cầu.' };
  }

  try {
    return { ok: true, data: JSON.parse(raw) as T };
  } catch {
    return { ok: false, message: 'Dữ liệu gửi lên không phải JSON hợp lệ.' };
  }
}
