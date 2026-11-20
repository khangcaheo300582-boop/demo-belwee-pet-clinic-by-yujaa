/**
 * Client-side API calls for the v1 authentication module.
 * Works in browser (Next.js client components) and React Native (fetch polyfill).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export interface LoginRequest {
  identity: string;
  password: string;
  device_info?: {
    device_type: 'web' | 'mobile';
    os?: string;
    app_version?: string;
    ip_address?: string;
    device_id?: string;
  };
}

export interface LoginResponse {
  success: true;
  user: {
    id: string;
    email: string;
    name: string;
    role?: string;
  };
  accessToken: string;
  refreshToken?: string; // only for mobile
  expiresIn: number;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  revoke_other_sessions?: boolean;
}

export interface ForgotPasswordRequest {
  identity: string;
  platform: 'web' | 'mobile';
}

export interface ResetPasswordRequest {
  token?: string;
  otp?: string;
  new_password: string;
  platform: 'web' | 'mobile';
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  locked?: boolean;
  retryAfterSeconds?: number;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as ApiError;
    throw new Error(err.message || 'Lỗi hệ thống');
  }
  return data;
}

export async function apiLogin(payload: LoginRequest): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // important for HttpOnly cookie (Web)
    body: JSON.stringify(payload),
  });
  return handleResponse<LoginResponse>(res);
}

export async function apiChangePassword(payload: ChangePasswordRequest, accessToken: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function apiForgotPassword(payload: ForgotPasswordRequest): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function apiResetPassword(payload: ResetPasswordRequest): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function apiRefreshToken(refreshToken?: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return handleResponse<LoginResponse>(res);
}

export async function apiLogout(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleResponse(res);
}

export async function apiHealth(): Promise<{ status: string; db: { status: string; latencyMs: number } }> {
  const res = await fetch(`${API_BASE}/api/health`);
  return handleResponse(res);
}
