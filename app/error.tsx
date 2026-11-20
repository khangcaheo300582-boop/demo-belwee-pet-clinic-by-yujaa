'use client';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void; }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-sky-50 px-4">
      <div className="max-w-md w-full rounded-[2rem] border border-white/70 bg-white/80 backdrop-blur-xl shadow-[0_20px_60px_rgba(37,99,235,0.12)] p-8 sm:p-10 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 border border-blue-100 text-4xl">🐾</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Ôi! Có lỗi xảy ra</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">Trang gặp sự cố nhỏ. Đừng lo — thú cưng của bạn vẫn ổn! Hãy thử tải lại hoặc quay về trang chủ.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={reset} className="flex-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 text-sm transition-all hover:scale-105 active:scale-95 shadow-[0_8px_24px_rgba(37,99,235,0.3)]">
            🔄 Thử lại
          </button>
          <a href="/" className="flex-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-6 text-sm transition-all hover:scale-105 active:scale-95 text-center">
            🏠 Về trang chủ
          </a>
        </div>
        {error?.digest && <p className="mt-6 text-[10px] text-slate-400 font-mono">Mã lỗi: {error.digest}</p>}
      </div>
    </div>
  );
}