/**
 * Next.js configuration — Connect.
 *
 * THIS FILE IS THE SINGLE AUTHORITY FOR RESPONSE SECURITY HEADERS.
 * `lib/security.ts` still exposes nonce-based CSP helpers, but nothing applies
 * them today; if a nonce rollout happens, it must replace the policy below
 * rather than run alongside it (two CSP headers intersect → most restrictive
 * wins, which silently breaks the app).
 *
 * @type {import('next').NextConfig}
 */

const isDev = process.env.NODE_ENV !== 'production'
const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? (await import('@next/bundle-analyzer')).default({ enabled: true })
    : (config) => config

/** Never let a malformed env value break the build: headers must degrade safely. */
function safeOrigin(value, fallback = '') {
  if (typeof value !== 'string' || value.length === 0) return fallback
  try {
    return new URL(value).origin
  } catch {
    return fallback
  }
}

const supabaseOrigin = safeOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabaseSocketOrigin = supabaseOrigin
  ? supabaseOrigin.replace(/^http/, 'ws')
  : ''

// ── Content Security Policy ──────────────────────────────────────────────────
// Browser-side origins ONLY. Upstash (rate limit), Resend (email) and
// Meilisearch are server-side and deliberately absent — the browser never
// contacts them, so allowing them would be attack surface for nothing.
// Keep this list in sync with `images.remotePatterns` and `.env.example`.
const scriptSrc = ["'self'", "'unsafe-inline'"]
const connectSrc = [
  "'self'",
  supabaseOrigin, // REST/auth/storage
  supabaseSocketOrigin, // Supabase Realtime (wss)
  'https://*.ably.io',
  'wss://*.ably.io',
  'https://*.ably-realtime.com',
  'wss://*.ably-realtime.com',
  'https://*.posthog.com',
  'https://*.sentry.io',
  'https://*.ingest.sentry.io',
  'https://challenges.cloudflare.com',
].filter(Boolean)

const imgSrc = [
  "'self'",
  'data:',
  'blob:',
  supabaseOrigin, // avatars/event media served from Storage
  'https://*.licdn.com', // LinkedIn imagery surfaced on profiles
  'https://*.licdn.cn',
].filter(Boolean)

if (isDev) {
  // Turbopack + React Refresh evaluate code and open the HMR websocket.
  scriptSrc.push("'unsafe-eval'")
  connectSrc.push('ws:', 'wss:', 'http://localhost:*', 'http://127.0.0.1:*')
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src ${scriptSrc.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src ${imgSrc.join(' ')}`,
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  `connect-src ${connectSrc.join(' ')}`,
  "frame-src 'self' https://challenges.cloudflare.com",
  // Meaningless over plain http and flagged by Safari in dev.
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '0' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), magnetometer=(), gyroscope=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  // HSTS on http://localhost would pin the dev origin to https — prod only.
  ...(isDev
    ? []
    : [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Stacks reach Sentry as build-time maps; never publish them to browsers.
  productionBrowserSourceMaps: false,
  experimental: {
    // Tree-shakes the icon barrel import used across ~40 components.
    optimizePackageImports: ['lucide-react', '@sentry/nextjs'],
  },
  images: {
    // Canonical allow-list for remote imagery (mirrors CSP `img-src`).
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/**',
      },
      { protocol: 'https', hostname: '**.licdn.com' },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // API responses are per-user and must never sit in a shared cache.
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
