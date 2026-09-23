// app/sitemap.ts
// Public, crawlable surface only. Authenticated shells (/dashboard, /admin,
// /settings) are intentionally absent — they are gated by proxy.ts and would
// only produce soft-404s for crawlers.
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

const PUBLIC_PATHS: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}> = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/browse', changeFrequency: 'daily', priority: 0.9 },
  { path: '/events/search', changeFrequency: 'daily', priority: 0.8 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = appUrl()
  const lastModified = new Date()

  return PUBLIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
