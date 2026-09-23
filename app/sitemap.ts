// app/sitemap.ts
// Public, crawlable surface only. Authenticated shells (/dashboard, /admin,
// /settings) are intentionally absent — they are gated by proxy.ts and would
// only produce soft-404s for crawlers. Dynamically includes published public
// events and community profiles.
import type { MetadataRoute } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { tryGetAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

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

const STATIC_PUBLIC_PATHS: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}> = [
  { path: '/', changeFrequency: 'daily', priority: 1.0 },
  { path: '/browse', changeFrequency: 'daily', priority: 0.9 },
  { path: '/events', changeFrequency: 'daily', priority: 0.9 },
  { path: '/events/search', changeFrequency: 'daily', priority: 0.8 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

interface PublicSitemapItem {
  id: string
  updated_at?: string | null
  created_at?: string | null
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = appUrl()
  const lastModified = new Date()

  const entries: MetadataRoute.Sitemap = STATIC_PUBLIC_PATHS.map(
    ({ path, changeFrequency, priority }) => ({
      url: `${baseUrl}${path}`,
      lastModified,
      changeFrequency,
      priority,
    }),
  )

  try {
    const supabase = await createServerSupabaseClient().catch(() => null)
    const client = supabase ?? tryGetAdminSupabaseClient()

    if (client) {
      // 1. Dynamic Public Events
      const { data: eventsData } = await (client as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            limit: (n: number) => Promise<{ data: unknown }>
          }
        }
      })
        .from('public_events')
        .select('id, updated_at, created_at')
        .limit(200)

      if (eventsData && Array.isArray(eventsData)) {
        for (const item of eventsData as PublicSitemapItem[]) {
          if (item?.id) {
            entries.push({
              url: `${baseUrl}/events/${item.id}`,
              lastModified: item.updated_at
                ? new Date(item.updated_at)
                : item.created_at
                  ? new Date(item.created_at)
                  : lastModified,
              changeFrequency: 'weekly',
              priority: 0.7,
            })
          }
        }
      }

      // 2. Dynamic Community Profiles
      const { data: profilesData } = await (client as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            limit: (n: number) => Promise<{ data: unknown }>
          }
        }
      })
        .from('public_search_profiles')
        .select('id, updated_at, created_at')
        .limit(200)

      if (profilesData && Array.isArray(profilesData)) {
        for (const item of profilesData as PublicSitemapItem[]) {
          if (item?.id) {
            entries.push({
              url: `${baseUrl}/profile/${item.id}`,
              lastModified: item.updated_at
                ? new Date(item.updated_at)
                : item.created_at
                  ? new Date(item.created_at)
                  : lastModified,
              changeFrequency: 'weekly',
              priority: 0.6,
            })
          }
        }
      }
    }
  } catch (err) {
    logger.warn('Sitemap dynamic entries fetch skipped', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return entries
}

