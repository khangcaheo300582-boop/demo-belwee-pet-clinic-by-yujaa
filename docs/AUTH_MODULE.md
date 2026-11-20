# Authentication & Password Reset Module

## Overview

A comprehensive authentication module supporting both **Web (PC)** and **Mobile** platforms.

## API Endpoints

### Base URL: `/api/v1/auth`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/login` | Login with credentials | No |
| POST | `/change-password` | Change password (logged in) | Yes (Bearer) |
| POST | `/forgot-password` | Request password reset | No |
| POST | `/reset-password` | Complete password reset | No |
| POST | `/refresh` | Refresh access token | No (uses refresh token) |
| POST | `/logout` | Logout / revoke session | No |

---

## 1. Login

### Request
```json
POST /api/v1/auth/login
Content-Type: application/json

{
  "identity": "user@example.com",
  "password": "MyP@ssw0rd",
  "device_info": {
    "device_type": "web",   // "web" | "mobile"
    "os": "Windows 11",
    "app_version": "1.0.0",
    "ip_address": "192.168.1.1",
    "device_id": "device-uuid"
  }
}
```

### Response (Web)
```json
{
  "success": true,
  "user": { "id": "USR_...", "email": "...", "name": "...", "role": "..." },
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresIn": 900
}
```
Refresh token is set via `HttpOnly; Secure; SameSite=Strict` cookie (`belwee_refresh_token`).

### Response (Mobile)
```json
{
  "success": true,
  "user": { "id": "USR_...", "email": "...", "name": "...", "role": "..." },
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresIn": 900
}
```
Mobile app must store both tokens in **Secure Storage** (Keychain / EncryptedSharedPreferences).

### Security
- Brute-force protection: 5 failed attempts → 15 min lock per email.
- Rate limiting: 12 requests/min per IP.
- Timing-safe password comparison.

---

## 2. Change Password

### Request
```http
POST /api/v1/auth/change-password
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "current_password": "OldP@ss1",
  "new_password": "NewP@ss2!",
  "revoke_other_sessions": true
}
```

### Password Policy
- Min 8 characters
- At least 1 uppercase, 1 lowercase, 1 digit, 1 special character
- Must differ from current password
- Must not match last 3 passwords

### Response
```json
{ "success": true, "message": "Đổi mật khẩu thành công." }
```

---

## 3. Forgot Password

### Request
```json
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "identity": "user@example.com",
  "platform": "web"   // "web" | "mobile"
}
```

### Web Flow
- System sends email with reset link: `https://app.com/reset-password?token=XYZ`
- Token expires in 15 minutes, single-use.

### Mobile Flow
- System sends 6-digit OTP via email.
- Mobile app calls `/reset-password` with `otp` field.

### Response (always 200, no email enumeration)
```json
{ "success": true, "message": "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi." }
```

---

## 4. Reset Password

### Request (Web — token)
```json
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "token": "abc123...",
  "new_password": "NewP@ss2!",
  "platform": "web"
}
```

### Request (Mobile — OTP)
```json
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "otp": "123456",
  "new_password": "NewP@ss2!",
  "platform": "mobile"
}
```

### Response
```json
{ "success": true, "message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại." }
```

On success: password updated, token/OTP invalidated, all sessions revoked.

---

## 5. Refresh Token

### Request (Web — uses cookie automatically)
```http
POST /api/v1/auth/refresh
```

### Request (Mobile — body)
```json
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refresh_token": "eyJhbGciOiJIUzI1NiJ9..." }
```

### Response
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresIn": 900
}
```

Refresh token is rotated on every refresh (old one revoked).

---

## 6. Logout

### Request
```http
POST /api/v1/auth/logout
```
(Web uses cookie; Mobile can send refresh token in body.)

### Response
```json
{ "success": true, "message": "Đăng xuất thành công." }
```

---

## Integration Guide

### Web (Next.js / React)

```typescript
// Login
const res = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identity: email, password, device_info: { device_type: 'web' } }),
  credentials: 'include', // important for cookies
});
const { accessToken } = await res.json();

// Store accessToken in memory (not localStorage)
// Refresh token is in HttpOnly cookie automatically

// Authenticated request
const res = await fetch('/api/protected', {
  headers: { Authorization: `Bearer ${accessToken}` },
});

// Refresh when accessToken expires
const refreshRes = await fetch('/api/v1/auth/refresh', {
  method: 'POST',
  credentials: 'include',
});
const { accessToken: newToken } = await refreshRes.json();
```

### Mobile (React Native / Flutter)

```typescript
// Login
const res = await fetch('https://api.example.com/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    identity: email,
    password,
    device_info: { device_type: 'mobile', os: 'iOS 17', app_version: '1.0.0' },
  }),
});
const { accessToken, refreshToken } = await res.json();

// Store in Secure Storage
await SecureStore.setItemAsync('accessToken', accessToken);
await SecureStore.setItemAsync('refreshToken', refreshToken);

// Authenticated request
const token = await SecureStore.getItemAsync('accessToken');
const res = await fetch('https://api.example.com/api/protected', {
  headers: { Authorization: `Bearer ${token}` },
});

// Refresh
const refreshRes = await fetch('https://api.example.com/api/v1/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refresh_token: await SecureStore.getItemAsync('refreshToken') }),
});
const { accessToken: newToken, refreshToken: newRefresh } = await refreshRes.json();
await SecureStore.setItemAsync('accessToken', newToken);
await SecureStore.setItemAsync('refreshToken', newRefresh);
```

---

## Security Features

- **Password hashing:** bcrypt (cost factor 12)
- **JWT:** HMAC-SHA256, 15-min access / 7-day refresh
- **Brute-force protection:** 5 attempts → 15-min lock per email
- **Rate limiting:** Per-IP + per-email (in-memory, Redis-ready)
- **Token rotation:** Refresh tokens rotated on every use
- **Session revocation:** Change password can revoke all other sessions
- **Timing attack protection:** Generic error messages, constant-time comparison
- **Email enumeration prevention:** Forgot password always returns success
- **Single-use reset tokens:** Invalidated after use
- **Password history:** Last 3 passwords cannot be reused

---

## Environment Variables

```env
# Required
JWT_SECRET=<at-least-32-chars>
MONGODB_URI=mongodb+srv://...
NEXT_PUBLIC_BASE_URL=https://your-app.com

# Email (for OTP/reset links)
EMAIL_USER=...
EMAIL_PASS=...
```

---

## Architecture Notes

- **Storage:** MongoDB collections: `users`, `auth_sessions`, `password_reset_tokens`
- **Rate limiter:** In-memory Map (swap for Redis in production)
- **Token format:** Standard JWT (header.payload.signature)
- **Cookie:** `belwee_refresh_token` (HttpOnly, Secure, SameSite=Strict)
- **Mobile:** Bearer token in Authorization header
