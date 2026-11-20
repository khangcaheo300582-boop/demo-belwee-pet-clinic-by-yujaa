"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthProvider } from '@/app/components/auth/AuthProvider';
import ResetPasswordForm from '@/app/components/auth/ResetPasswordForm';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | undefined>();
  const [otp, setOtp] = useState<string | undefined>();
  const [platform, setPlatform] = useState<'web' | 'mobile'>('web');

  useEffect(() => {
    const t = searchParams.get('token');
    const o = searchParams.get('otp');
    if (t) setToken(t);
    if (o) setOtp(o);
    // Detect mobile from user agent or query
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    setPlatform(/Mobile|Android|iOS|iPhone|iPad/.test(ua) ? 'mobile' : 'web');
  }, [searchParams]);

  if (!token && !otp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900">Lỗi</h2>
          <p className="text-gray-600">Không tìm thấy mã khôi phục. Vui lòng yêu cầu lại.</p>
          <a
            href="/auth/forgot-password"
            className="mt-4 inline-block text-blue-600 hover:underline font-medium"
          >
            Yêu cầu khôi phục mật khẩu
          </a>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Belwee</h1>
            <p className="text-gray-600">Đặt lại mật khẩu mới</p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <ResetPasswordForm token={token} otp={otp} platform={platform} />
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
