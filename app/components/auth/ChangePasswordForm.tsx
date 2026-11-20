"use client";

import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { apiChangePassword } from './auth-api';

export interface ChangePasswordFormProps {
  onSuccess?: () => void;
}

export default function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
  const { accessToken } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
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

    if (!accessToken) {
      setError('Không tìm thấy phiên làm việc. Vui lòng đăng nhập lại.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiChangePassword(
        {
          current_password: currentPassword,
          new_password: newPassword,
          revoke_other_sessions: true,
        },
        accessToken
      );
      setMessage(res.message);
      setDone(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Đổi mật khẩu thất bại. Vui lòng thử lại.');
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
        <p className="text-sm text-gray-500">
          Tất cả các phiên làm việc khác đã bị thu hồi.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <h2 className="text-2xl font-bold text-gray-900">Đổi mật khẩu</h2>
      <p className="text-sm text-gray-600">
        Cập nhật mật khẩu mới để bảo mật tài khoản.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {message}
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Mật khẩu hiện tại
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          placeholder="••••••••"
        />
      </div>

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
          Xác nhận mật khẩu mới
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
        {loading ? 'Đang đổi...' : 'Đổi mật khẩu'}
      </button>
    </form>
  );
}
