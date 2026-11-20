// import Sentry from '@sentry/nextjs'; // Tắt tạm thời do CommonJS named export incompatibility

/**
 * `next dev` and `next build` must never share an output directory.
 *
 * ROOT CAUSE of this repo's long-standing "random" build failures —
 * `PageNotFoundError: Cannot find module for page: /_document` (and the
 * `/api/...` / `pages-manifest.json` / `route.js.nft.json` variants):
 *
 * `next dev` keeps a server alive and rewrites `distDir` on every on-demand
 * compile — `server/pages-manifest.json`, `server/app-paths-manifest.json`,
 * `build-manifest.json`, `static/**`, `.nft.json` traces. A `next build`
 * running against the same directory writes exactly those files, so the two
 * processes clobber each other mid-build. `Collecting page data` then reads a
 * *dev-shaped* `pages-manifest.json`, where `/_document` is absent, and
 * `getPagePath` throws. The result looks like a corrupt `.next`, so people
 * "fix" it by deleting `.next` — which is why it always comes back: the dev
 * server is still running.
 *
 * Fix at the root: give development its own directory. Then a dev server and
 * a production build can safely coexist, and `npm start` still serves `.next`.
 *
 * `next/dist/bin/next` assigns `process.env.NODE_ENV` before this config is
 * loaded: `development` for `dev`, `production` for everything else
 * (`build`, `start`, `lint`) — so the branch below is reliable.
 */
const isDev = process.env.NODE_ENV !== 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: isDev ? '.next-dev' : '.next',

  // ── PERF: Image optimization ───────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
    // PERF: AVIF encoding is roughly an order of magnitude slower than WebP and
    // shows up directly as time-to-image while `next dev` compiles on demand.
    // Pay for AVIF in production, where the encode is cached and amortised.
    formats: isDev ? ['image/webp'] : ['image/avif', 'image/webp'],
    // Same reason: a 30-day minimum TTL in development means editing an image
    // in /public leaves the stale optimised variant on screen and looks like a
    // caching bug. Production keeps the long TTL.
    minimumCacheTTL: isDev ? 0 : 60 * 60 * 24 * 30,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // ── PERF: Compression & headers ────────────────────────────────────
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  // ── PERF: Standalone output for Docker / production deployment ─────
  // Keeps `node_modules` pruned to production deps only and copies the
  // server into `.next/standalone` so `npm start` can run without a full
  // monorepo install.
  output: 'standalone',

  // ── EXPERIMENTAL: turbo + server actions ───────────────────────────
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Tối ưu tree-shaking cho framer-motion và các lib lớn
    optimizePackageImports: ['framer-motion', 'lucide-react'],
  },

  // ── HEADERS: security + caching ────────────────────────────────────
  headers: async () => [
    {
      // Security headers for all non-API routes.
      source: '/((?!api/).*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
          key: 'Content-Security-Policy',
          value:
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https: blob:; " +
            "font-src 'self' data:; " +
            "connect-src 'self' https://api.unsplash.com https://belwee.vn; " +
            "frame-ancestors 'none'; " +
            "report-uri /api/v1/security/csp-report;",
        },
        {
          key: 'Permissions-Policy',
          value:
            'camera=(), microphone=(), geolocation=(), payment=(), usb=(), ' +
            'magnetometer=(), gyroscope=(), accelerometer=()',
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload',
        },
      ],
    },
    {
      // PERF/CACHE: HTML + manifest.json phải revalidate mỗi lần (Next.js RSC
      // payload đổi theo deploy) — no-cache cho phép cache nhưng phải hỏi lại,
      // tức CDN trình duyệt có thể phục vụ 304 mà không tải lại toàn bộ.
      source: '/((?!api/|_next/static/).*)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
      ],
    },
    {
      // PERF: cache tổng quát mọi video tĩnh.
      source: '/(.*)\\.(mp4|webm|ogg|ogv|mov)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
    {
      source: '/(.*)\\.(png|jpg|jpeg|gif|webp|avif|svg|ico)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
  ],
};

export default nextConfig;
