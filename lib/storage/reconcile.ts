// src/lib/storage/reconcile.ts
// Storage reconciliation utility.
//
// Lists objects in the known storage buckets that no longer have a referencing
// row in the database (orphans). This complements the per-feature reconcile
// jobs (e.g. event_media lifecycle reconciliation) by catching objects whose
// DB row was removed independently — a quota leak if left alone.
//
// Server-only: uses the admin client (bypasses RLS). Never import from a
// client component.

import { getAdminSupabaseClient } from '@/lib/supabase/admin'

import { logger } from '@/lib/logger'

export type StorageBucket = 'avatars' | 'match-attachments' | 'event-media'

export interface OrphanedObject {
  bucket: StorageBucket
  path: string
}

const KNOWN_BUCKETS: StorageBucket[] = [
  'avatars',
  'match-attachments',
  'event-media',
]

const PAGE_SIZE = 500

/**
 * S50 — every storage object has discoverable ownership derived from its
 * bucket + bucket-relative path convention:
 *
 *   avatars `{userId}/{file}`               → owner = userId
 *   match-attachments `{matchId}/{file}`    → owner = matchId (match membership
 *     resolves to user ownership via `can_access_match_attachment` RLS +
 *     `assertThreadAccess` service checks)
 *   event-media `{eventId}/{file}`          → owner = eventId (organizer
 *     ownership resolved via the event row)
 *
 * Returns null when the path does not follow the bucket contract — callers
 * treat unowned paths as orphans, never as authorized.
 */
export function ownerOfStorageObject(
  bucket: StorageBucket,
  path: string,
): string | null {
  const segments = path.split('/')
  if (segments.length !== 2) return null
  const [owner, file] = segments as [string, string]
  if (!owner || !file) return null
  if (
    bucket === 'avatars' ||
    bucket === 'match-attachments' ||
    bucket === 'event-media'
  ) {
    return owner
  }
  return null
}

/**
 * S50 — unbounded paginated listing. Loops until a short page arrives; there
 * is deliberately NO page-count hard stop so deletion/enumeration always runs
 * to exhaustion (a cap would silently leak quota / retain erased data).
 */
export async function listAllPageNames(
  list: (offset: number) => Promise<string[] | null>,
): Promise<string[]> {
  const names: string[] = []
  let offset = 0
  for (;;) {
    const page = await list(offset)
    if (!page || page.length === 0) break
    names.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return names
}

const AVATAR_URL_PATTERN = /\/avatars\/(.+)$/

/**
 * Enumerate every object path stored in a bucket (relative to the bucket
 * root). Avatars, match-attachments and event-media all use a single
 * two-level layout (`{owner}/{file}`), so two levels of listing suffice.
 */
async function listBucketObjectPaths(
  supabase: ReturnType<typeof getAdminSupabaseClient>,
  bucket: StorageBucket,
): Promise<string[]> {
  const paths: string[] = []

  const folders: string[] = []

  await collectLevel(supabase, bucket, '', paths, folders)

  for (const folder of folders) {
    const nested: string[] = []

    await collectLevel(supabase, bucket, folder, nested, [])

    for (const path of nested) {
      paths.push(`${folder}/${path}`)
    }
  }

  return paths
}

async function collectLevel(
  supabase: ReturnType<typeof getAdminSupabaseClient>,
  bucket: StorageBucket,
  prefix: string,
  files: string[],
  folders: string[],
): Promise<void> {
  // S50 — paginate to exhaustion (no MAX_PAGES hard stop: a cap would hide
  // objects past the cut and misreport them as "no orphans").
  let offset = 0
  for (;;) {
    const { data: objects, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE_SIZE, offset })

    if (error || !objects || objects.length === 0) {
      break
    }

    for (const raw of objects) {
      // Storage `list()` returns a union of file/folder summaries; widen to
      // the shared shape so folder entries without an `id` are handled too.
      const object = raw as { name?: string; id?: string }
      const name = object.name
      if (!name) {
        continue
      }

      // Folder summaries lack an `id`; real files carry one.
      if ('id' in object) {
        files.push(name)
      } else {
        folders.push(name)
      }
    }

    if (objects.length < PAGE_SIZE) {
      break
    }

    offset += PAGE_SIZE
  }
}

/**
 * Load the set of bucket-relative object paths that are referenced by at
 * least one database row.
 */
async function loadReferencedObjectPaths(
  supabase: ReturnType<typeof getAdminSupabaseClient>,
): Promise<Record<StorageBucket, Set<string>>> {
  const [avatarRows, messageRows, mediaRows] = await Promise.all([
    supabase
      .from('profiles')
      .select('avatar_url')
      .not('avatar_url', 'is', null),
    supabase
      .from('messages')
      .select('attachment_url')
      .not('attachment_url', 'is', null),
    supabase
      .from('event_media')
      .select('storage_path')
      .not('storage_path', 'is', null),
  ])

  const avatars = new Set<string>()

  for (const row of avatarRows.data ?? []) {
    const match = AVATAR_URL_PATTERN.exec(row.avatar_url ?? '')

    if (match?.[1]) {
      avatars.add(match[1])
    }
  }

  const attachments = new Set<string>()

  for (const row of messageRows.data ?? []) {
    if (row.attachment_url) {
      attachments.add(row.attachment_url)
    }
  }

  const media = new Set<string>()

  for (const row of mediaRows.data ?? []) {
    if (row.storage_path) {
      media.add(row.storage_path)
    }
  }

  return {
    avatars,
    'match-attachments': attachments,
    'event-media': media,
  }
}

/**
 * List storage objects that exist in a bucket but have no referencing row in
 * the database. Bucket-relative paths are compared against:
 *
 *   avatars          profiles.avatar_url          (public URL suffix)
 *   match-attachments messages.attachment_url     (bucket-relative path)
 *   event-media      event_media.storage_path     (bucket-relative path)
 *
 * Returns stable tuples (bucket, path) so callers can decide what to remove.
 */
export async function listOrphanedObjects(): Promise<OrphanedObject[]> {
  const supabase = getAdminSupabaseClient()

  const [referenced, buckets] = await Promise.all([
    loadReferencedObjectPaths(supabase),
    Promise.all(
      KNOWN_BUCKETS.map(async (bucket) => ({
        bucket,
        paths: await listBucketObjectPaths(supabase, bucket),
      })),
    ),
  ])

  const orphans: OrphanedObject[] = []

  for (const { bucket, paths } of buckets) {
    for (const path of paths) {
      if (!referenced[bucket].has(path)) {
        orphans.push({ bucket, path })
      }
    }
  }

  logger.info('Storage reconciliation complete', {
    buckets: KNOWN_BUCKETS,
    orphans: orphans.length,
  })

  return orphans
}
