"use client";

import { AuthProvider, useAuth } from '@/app/components/auth/AuthProvider';
import ChangePasswordForm from '@/app/components/auth/ChangePasswordForm';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function ChangePasswordPageInner() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // handled by redirect above
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Belwee</h1>
          <p className="text-gray-600">Thay đổi mật khẩu</p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          <ChangePasswordForm
            onSuccess={() => {
              // Optionally redirect to dashboard after success
              setTimeout(() => {
                router.push('/');
              }, 1500);
            }}
          />
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <a href="/" className="text-blue-600 hover:underline font-medium">
            Về trang chủ
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <AuthProvider>
      <ChangePasswordPageInner />
    </AuthProvider>
  );
}
