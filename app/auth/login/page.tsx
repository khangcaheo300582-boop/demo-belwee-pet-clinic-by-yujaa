"use client";

import { AuthProvider } from '@/app/components/auth/AuthProvider';
import LoginForm from '@/app/components/auth/LoginForm';
import ForgotPasswordForm from '@/app/components/auth/ForgotPasswordForm';
import { useState } from 'react';

export default function LoginPage() {
  const [showForgot, setShowForgot] = useState(false);

  return (
    <AuthProvider>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Belwee</h1>
            <p className="text-gray-600">Pet Clinic - Portal nhân viên</p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            {showForgot ? (
              <ForgotPasswordForm
                platform="web"
                onSuccess={() => setShowForgot(false)}
              />
            ) : (
              <LoginForm
                platform="web"
                onSuccess={() => {
                  // Redirect after login
                  window.location.href = '/';
                }}
              />
            )}
          </div>

          <div className="mt-6 text-center text-sm text-gray-600">
            {showForgot ? (
              <button
                onClick={() => setShowForgot(false)}
                className="text-blue-600 hover:underline font-medium"
              >
                Quay lại đăng nhập
              </button>
            ) : (
              <button
                onClick={() => setShowForgot(true)}
                className="text-blue-600 hover:underline font-medium"
              >
                Quên mật khẩu?
              </button>
            )}
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
