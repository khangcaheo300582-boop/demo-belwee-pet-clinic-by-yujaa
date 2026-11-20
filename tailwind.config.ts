import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        secondary: '#3b82f6',
        dark: '#1e293b',
        body: '#64748b',
        bgLight: '#f4f7fb'
      },
      fontFamily: {
        nunito: ['var(--font-nunito)', 'sans-serif'],
      },
      spacing: {
        '4.5': '1.125rem',
        '8.5': '2.125rem',
      },
      padding: {
        '4.5': '1.125rem',
      },
      width: {
        '4.5': '1.125rem',
        '8.5': '2.125rem',
      },
      height: {
        '4.5': '1.125rem',
        '8.5': '2.125rem',
      },
      backdropBlur: {
        '2xl': '30px',
        '3xl': '50px',
      },
      boxShadow: {
        'glass': '0 8px 30px rgba(0, 0, 0, 0.12)',
        // ── Apple Liquid Glass / visionOS ────────────────────────
        'vision-glass': '0 8px 32px 0 rgba(0, 0, 0, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.6), inset 0 -1px 1px 0 rgba(255, 255, 255, 0.15)',
        'vision-glass-hover': '0 16px 48px 0 rgba(0, 0, 0, 0.1), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 1px 0 rgba(255, 255, 255, 0.25)',
        'liquid-glow-emerald': '0 0 40px -10px rgba(52, 211, 153, 0.6), inset 0 1px 1px 0 rgba(255, 255, 255, 0.5)',
        'spatial-depth': '0 40px 80px -10px rgba(0,0,0,0.3), 0 20px 40px -10px rgba(0,0,0,0.2)',
      },
      backgroundImage: {
        'liquid-mesh': 'radial-gradient(at 40% 20%, hsla(142,71%,45%,0.12) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,0.12) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(355,100%,93%,0.08) 0px, transparent 50%)',
        'glass-noise': "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxmaWx0ZXIgaWQ9Im4iPjxmZVR1cmJ1bGVuY2UgdHlwZT0iZnJhY3RhbE5vaXNlIiBiYXNlRnJlcXVlbmN5PSIwLjgzIiBudW1PY3RhdmVzPSIzIiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI24pIiBvcGFjaXR5PSIwLjA0Ii8+PC9zdmc+')",
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px) scale(0.95)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        // ── Liquid Glass motion presets ──────────────────────────
        fluidWobble: {
          '0%, 100%': { borderRadius: '24px' },
          '33%': { borderRadius: '20px 28px 24px 20px' },
          '66%': { borderRadius: '28px 20px 20px 28px' },
        },
        shimmerLiquid: {
          '0%': { transform: 'translateX(-150%) skewX(-15deg)' },
          '100%': { transform: 'translateX(150%) skewX(-15deg)' },
        },
        stampDrop: {
          '0%': { transform: 'scale(3) rotate(-15deg)', opacity: '0' },
          '50%': { transform: 'scale(0.9) rotate(-15deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-15deg)', opacity: '1' },
        },
        rippleExpand: {
          '0%': { transform: 'scale(0)', opacity: '0.5' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        // ── Skeleton shimmer ─────────────────────────────────────
        // Thanh sáng chạy ngang BẰNG TRANSFORM (không phải background-position
        // như các bản animation-pulse/background-position cũ): chỉ tốn 1 lớp
        // compositor, không buộc trình duyệt vẽ lại nền mỗi frame.
        // Thanh sáng rộng 1/2 khối, chạy từ -120% tới 220% chiều rộng CỦA NÓ
        // (≈ -60% → +110% chiều rộng khối) nên đi hết khối rồi mới ra ngoài;
        // dừng ở 120% sẽ khiến nửa phải không bao giờ được quét sáng.
        skeletonSheen: {
          '0%': { transform: 'translate3d(-120%, 0, 0)' },
          '100%': { transform: 'translate3d(220%, 0, 0)' },
        },
      },
      animation: {
        'blob': 'blob 7s infinite',
        'slideDown': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fluid-wobble': 'fluidWobble 6s ease-in-out infinite',
        'shimmer-liquid': 'shimmerLiquid 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'stamp-drop': 'stampDrop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'ripple-expand': 'rippleExpand 0.8s ease-out forwards',
        // Tắt bằng tiện ích `motion-reduce:animate-none` ở component, không
        // cần thêm media query riêng trong CSS.
        'skeleton-sheen': 'skeletonSheen 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
    }
  },
  plugins: [],
}

export default config
