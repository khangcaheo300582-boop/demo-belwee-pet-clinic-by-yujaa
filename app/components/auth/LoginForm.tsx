"use client";

import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { apiLogin } from './auth-api';
import Link from 'next/link';

export interface LoginFormProps {
  onSuccess?: () => void;
  platform?: 'web' | 'mobile';
}

export default function LoginForm({ onSuccess, platform = 'web' }: LoginFormProps) {
  const { login } = useAuth();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiLogin({
        identity,
        password,
        device_info: {
          device_type: platform,
          os: typeof navigator !== 'undefined' ? navigator.platform : undefined,
          app_version: '1.0.0',
        },
      });

      login(res.accessToken, res.user);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Đăng nhập</h2>
      <p className="text-sm text-gray-600">
        Chào mừng bạn quay lại Belwee Pet Clinic
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Email hoặc tên đăng nhập
        </label>
        <input
          type="text"
          autoComplete="username"
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          placeholder="nhap@example.com"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Mật khẩu
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg transition-colors"
      >
        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>

      <div className="text-center text-sm text-gray-600">
        Chưa có tài khoản?{' '}
        <Link href="/auth/register" className="text-blue-600 hover:underline font-medium">
          Đăng ký ngay
        </Link>
      </div>

      <div className="text-center mt-4">
        <button
          type="button"
          onClick={() => {
            // Trigger forgot password flow
            const event = new CustomEvent('forgot-password');
            window.dispatchEvent(event);
          }}
          className="text-sm text-blue-600 hover:underline"
        >
          Quên mật khẩu?
        </button>
      </div>
    </form>
  );
}
