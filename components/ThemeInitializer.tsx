// components/ThemeInitializer.tsx
"use client";

import { useEffect } from 'react';

// Hàm xử lý đổi trục màu toàn hệ thống bằng CSS Variables
export const applyThemeColors = (value: number) => {
  const hue = Math.max(0, 240 - (value * 2.4)); // 0% -> HUE 240 (Xanh lam), 100% -> HUE 0 (Đỏ)
  const primaryColor = `hsl(${hue}, 85%, 60%)`;
  const primaryGlow = `hsla(${hue}, 85%, 60%, 0.45)`;
  const primaryBg = `hsla(${hue}, 85%, 60%, 0.1)`;
  const primaryBorder = `hsla(${hue}, 85%, 60%, 0.2)`;

  document.documentElement.style.setProperty('--theme-primary', primaryColor);
  document.documentElement.style.setProperty('--theme-glow', primaryGlow);
  document.documentElement.style.setProperty('--theme-bg', primaryBg);
  document.documentElement.style.setProperty('--theme-border', primaryBorder);
};

export default function ThemeInitializer() {
  useEffect(() => {
    // 1. Đồng bộ màu ngay lập tức khi người dùng vừa F5 hoặc chuyển trang
    const savedThemeVal = localStorage.getItem('belwee-theme-val');
    applyThemeColors(savedThemeVal ? Number(savedThemeVal) : 50);

    // 2. Lắng nghe tín hiệu thay đổi thời gian thực từ Trang cá nhân (Cùng một Tab)
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail !== undefined) {
        applyThemeColors(customEvent.detail);
      }
    };

    // 3. Lắng nghe thay đổi từ các Tab trình duyệt khác nhau (Nếu mở song song nhiều tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'belwee-theme-val' && e.newValue) {
        applyThemeColors(Number(e.newValue));
      }
    };

    window.addEventListener('belwee-theme-changed', handleThemeChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('belwee-theme-changed', handleThemeChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return null; // Chạy ngầm hoàn toàn, không sinh mã HTML thừa
}
