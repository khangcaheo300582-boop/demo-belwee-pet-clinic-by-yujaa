"use client";

import { AuthProvider } from '@/app/components/auth/AuthProvider';
import ForgotPasswordForm from '@/app/components/auth/ForgotPasswordForm';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Belwee</h1>
            <p className="text-gray-600">Khôi phục mật khẩu</p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <ForgotPasswordForm platform="web" />
          </div>

          <div className="mt-6 text-center text-sm text-gray-600">
            Quay lại{' '}
            <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
              đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
