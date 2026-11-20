// lib/auth-schemas.ts
// Zod validation schemas for the authentication module.
// Shared between Web (PC) and Mobile clients.

import { z } from 'zod';

export const LOGIN_SCHEMA = z.object({
  identity: z.string().trim().min(1, 'Email hoặc tên đăng nhập không được để trống.').max(254),
  password: z.string().min(1, 'Mật khẩu không được để trống.').max(128),
  device_info: z
    .object({
      device_type: z.enum(['web', 'mobile']).default('web'),
      os: z.string().max(64).optional(),
      app_version: z.string().max(32).optional(),
      ip_address: z.string().max(45).optional(),
      device_id: z.string().max(128).optional(),
    })
    .optional(),
});

export const CHANGE_PASSWORD_SCHEMA = z
  .object({
    current_password: z.string().min(1, 'Mật khẩu hiện tại không được để trống.').max(128),
    new_password: z
      .string()
      .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự.')
      .max(128)
      .regex(/[A-Z]/, 'Mật khẩu mới phải chứa ít nhất một chữ hoa.')
      .regex(/[a-z]/, 'Mật khẩu mới phải chứa ít nhất một chữ thường.')
      .regex(/[0-9]/, 'Mật khẩu mới phải chứa ít nhất một chữ số.')
      .regex(/[^A-Za-z0-9]/, 'Mật khẩu mới phải chứa ít nhất một ký tự đặc biệt.'),
    revoke_other_sessions: z.boolean().optional().default(false),
  })
  .refine((data) => data.current_password !== data.new_password, {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    path: ['new_password'],
  });

export const FORGOT_PASSWORD_SCHEMA = z.object({
  identity: z.string().trim().min(1, 'Email hoặc tên đăng nhập không được để trống.').max(254),
  platform: z.enum(['web', 'mobile']).default('web'),
});

export const RESET_PASSWORD_SCHEMA = z.object({
  token: z.string().trim().min(1, 'Token không được để trống.').optional(),
  otp: z.string().trim().regex(/^\d{6}$/, 'Mã OTP phải gồm đúng 6 chữ số.').optional(),
  new_password: z
    .string()
    .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự.')
    .max(128)
    .regex(/[A-Z]/, 'Mật khẩu mới phải chứa ít nhất một chữ hoa.')
    .regex(/[a-z]/, 'Mật khẩu mới phải chứa ít nhất một chữ thường.')
    .regex(/[0-9]/, 'Mật khẩu mới phải chứa ít nhất một chữ số.')
    .regex(/[^A-Za-z0-9]/, 'Mật khẩu mới phải chứa ít nhất một ký tự đặc biệt.'),
  platform: z.enum(['web', 'mobile']).default('web'),
}).refine((data) => data.token || data.otp, {
  message: 'Phải cung cấp token hoặc mã OTP.',
  path: ['token'],
});

export const REFRESH_TOKEN_SCHEMA = z.object({
  refresh_token: z.string().trim().min(1, 'Refresh token không được để trống.').optional(),
});

export type LoginInput = z.infer<typeof LOGIN_SCHEMA>;
export type ChangePasswordInput = z.infer<typeof CHANGE_PASSWORD_SCHEMA>;
export type ForgotPasswordInput = z.infer<typeof FORGOT_PASSWORD_SCHEMA>;
export type ResetPasswordInput = z.infer<typeof RESET_PASSWORD_SCHEMA>;
export type RefreshTokenInput = z.infer<typeof REFRESH_TOKEN_SCHEMA>;
