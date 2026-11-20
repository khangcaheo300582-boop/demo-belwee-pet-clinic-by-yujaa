"use client";

import { useState } from 'react';
import { apiResetPassword } from './auth-api';
import { useRouter } from 'next/navigation';

export interface ResetPasswordFormProps {
  token?: string;
  otp?: string;
  platform?: 'web' | 'mobile';
  onSuccess?: () => void;
}

export default function ResetPasswordForm({ token, otp, platform = 'web', onSuccess }: ResetPasswordFormProps) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiResetPassword({
        token,
        otp,
        new_password: newPassword,
        platform,
      });
      setMessage(res.message);
      setDone(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const isValidPassword = (pw: string) => {
    return (
      pw.length >= 8 &&
      /[A-Z]/.test(pw) &&
      /[a-z]/.test(pw) &&
      /[0-9]/.test(pw) &&
      /[^A-Za-z0-9]/.test(pw)
    );
  };

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Thành công</h2>
        <p className="text-sm text-gray-600">{message}</p>
        <button
          onClick={() => {
            router.push('/auth/login');
          }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors"
        >
          Đăng nhập
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Đặt lại mật khẩu</h2>
      <p className="text-sm text-gray-600">
        Tạo mật khẩu mới cho tài khoản của bạn.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Mật khẩu mới
        </label>
        <input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          placeholder="••••••••"
        />
        <p className="text-xs text-gray-500">
          Ít nhất 8 ký tự, 1 chữ hoa, 1 chữ thường, 1 số, 1 ký tự đặc biệt
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Xác nhận mật khẩu
        </label>
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          placeholder="••••••••"
        />
      </div>

      {!isValidPassword(newPassword) && newPassword.length > 0 && (
        <div className="text-xs text-red-600">
          Mật khẩu chưa đạt yêu cầu bảo mật.
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !isValidPassword(newPassword) || newPassword !== confirmPassword}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg transition-colors"
      >
        {loading ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
      </button>

      <div className="text-center text-sm text-gray-600">
        Quay lại{' '}
        <button
          type="button"
          onClick={() => {
            router.push('/auth/login');
          }}
          className="text-blue-600 hover:underline font-medium"
        >
          trang đăng nhập
        </button>
      </div>
    </form>
  );
}
