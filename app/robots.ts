// app/robots.ts
// Crawler policy: the marketing surface is indexable, every authenticated or
// machine surface is not. `/api/*` is disallowed wholesale so no probe route
// leaks into search indexes.
import type { MetadataRoute } from 'next'

function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      return new URL(raw).origin
    } catch {
      // fall through to the local default
    }
  }
  return 'http://localhost:3000'
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = appUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/browse',
          '/privacy',
          '/terms',
          '/events',
          '/events/*',
          '/events/search',
          '/profile/*',
        ],
        disallow: [
          '/api/',
          '/dashboard',
          '/dashboard/*',
          '/admin',
          '/admin/*',
          '/settings',
          '/settings/*',
          '/login',
          '/logout',
          '/callback',
          '/suspended',
          '/traction',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}

