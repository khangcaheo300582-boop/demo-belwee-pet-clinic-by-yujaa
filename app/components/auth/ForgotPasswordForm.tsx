"use client";

import { useState } from 'react';
import { apiForgotPassword } from './auth-api';

export interface ForgotPasswordFormProps {
  onSuccess?: () => void;
  platform?: 'web' | 'mobile';
}

export default function ForgotPasswordForm({ onSuccess, platform = 'web' }: ForgotPasswordFormProps) {
  const [identity, setIdentity] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await apiForgotPassword({ identity, platform });
      setMessage(res.message);
      setSent(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Không thể gửi yêu cầu khôi phục. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Đã ghi nhận yêu cầu</h2>
        <p className="text-sm text-gray-600">{message}</p>
        <p className="text-sm text-gray-500">
          Nếu email này có tài khoản, hướng dẫn đặt lại mật khẩu sẽ đến trong ít phút.
          Không thấy thư? Hãy kiểm tra mục Thư rác và chắc chắn bạn dùng đúng email đã đăng ký.
        </p>
        <button
          onClick={() => {
            setSent(false);
            setMessage('');
            setIdentity('');
          }}
          className="text-sm text-blue-600 hover:underline font-medium"
        >
          Gửi yêu cầu khác
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Quên mật khẩu</h2>
      <p className="text-sm text-gray-600">
        Nhập email đăng ký để nhận hướng dẫn đặt lại mật khẩu.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          type="email"
          autoComplete="email"
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          placeholder="nhap@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg transition-colors"
      >
        {loading ? 'Đang gửi...' : 'Gửi mã khôi phục'}
      </button>

      <div className="text-center text-sm text-gray-600">
        Nhớ mật khẩu rồi?{' '}
        <button
          type="button"
          onClick={() => {
            const event = new CustomEvent('back-to-login');
            window.dispatchEvent(event);
          }}
          className="text-blue-600 hover:underline font-medium"
        >
          Đăng nhập
        </button>
      </div>
    </form>
  );
}
