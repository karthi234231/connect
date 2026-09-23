// src/lib/meilisearch/sync.ts — SYNC WORKER (§339 row "Meilisearch": client,
// index schema, sync worker, search adapter, tests; §340 steps 9–12).
// INVARIANTS: (1) THE VIEW IS THE GATE — documents only from
// public_search_profiles; never read profiles directly. (2) THE INDEX IS
// DERIVED — idempotent upserts keyed on id; reindexProfiles rebuilds it.
// FAIL OPEN: writers return enabled:false when unconfigured, never throw.
import type { Meilisearch } from 'meilisearch'
import { logger } from '@/lib/logger'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { getMeiliClient, readMeiliConfig } from '@/lib/meilisearch/client'
import {
  MEILI_INDEXES,
  indexUid,
  profileIndexSettings,
} from '@/lib/meilisearch/indexes'
import {
  PROFILE_PRIMARY_KEY,
  toProfileSearchDocuments,
} from '@/lib/meilisearch/documents'
import type { ProfileRow } from '@/lib/dto'

export const REINDEX_PAGE_SIZE = 1000
export const REINDEX_MAX_ROWS = 50000
export interface SyncResult {
  enabled: boolean
  indexed: number
  deleted: number
}
const DISABLED: SyncResult = { enabled: false, indexed: 0, deleted: 0 }
export function profileIndexUid(): string {
  return indexUid(MEILI_INDEXES.profiles, readMeiliConfig().indexPrefix)
}
async function awaitTask(client: Meilisearch, taskUid: number): Promise<void> {
  // SDK mutations return EnqueuedTask (a uid handle); poll via the tasks API.
  await client.tasks.waitForTask(taskUid)
}
function isAlreadyExists(error: unknown): boolean {
  // 409 index_already_exists is the desired end state — bootstrap is deploy-safe.
  if (!error || typeof error !== 'object') return false
  const c = error as {
    cause?: { code?: string; errorCode?: string }
    code?: string
    message?: string
  }
  const code = c.cause?.code ?? c.cause?.errorCode ?? c.code
  if (code === 'index_already_exists') return true
  return typeof c.message === 'string'
    ? c.message.includes('index_already_exists')
    : false
}
export async function ensureProfileIndex(): Promise<{
  enabled: boolean
  created: boolean
  settingsApplied: boolean
  uid: string | null
}> {
  const client = getMeiliClient()
  if (!client)
    return {
      enabled: false,
      created: false,
      settingsApplied: false,
      uid: null,
    }
  const uid = profileIndexUid()
  let created = false
  try {
    const t = await client.createIndex(uid, {
      primaryKey: PROFILE_PRIMARY_KEY,
    })
    await awaitTask(client, t.taskUid)
    created = true
  } catch (e) {
    if (!isAlreadyExists(e)) {
      logger.error('Meili: index creation failed', {
        uid,
        error: e instanceof Error ? e.message : String(e),
      })
      return { enabled: true, created: false, settingsApplied: false, uid }
    }
  }
  let settingsApplied = false
  try {
    const t = await client.index(uid).updateSettings(profileIndexSettings())
    await awaitTask(client, t.taskUid)
    settingsApplied = true
  } catch (e) {
    logger.error('Meili: settings apply failed', {
      uid,
      error: e instanceof Error ? e.message : String(e),
    })
  }
  logger.info('Meili index ensured', { uid, created, settingsApplied })
  return { enabled: true, created, settingsApplied, uid }
}
/** Incremental upsert from profile rows; never throws. */
export async function syncProfileDocuments(
  rows: readonly ProfileRow[],
): Promise<SyncResult> {
  const meili: Meilisearch | null = getMeiliClient()
  if (!meili) return DISABLED
  const documents = toProfileSearchDocuments(rows)
  if (documents.length === 0) return { enabled: true, indexed: 0, deleted: 0 }
  try {
    const t = await meili
      .index(profileIndexUid())
      .addDocuments(documents, { primaryKey: PROFILE_PRIMARY_KEY })
    await awaitTask(meili, t.taskUid)
    logger.debug('Meili: profiles indexed', { count: documents.length })
    return { enabled: true, indexed: documents.length, deleted: 0 }
  } catch (e) {
    logger.error('Meili: document sync failed', {
      count: documents.length,
      error: e instanceof Error ? e.message : String(e),
    })
    return { enabled: true, indexed: 0, deleted: 0 }
  }
}
/** Remove departed profiles (visibility/suspension/deletion); never throws. */
export async function deleteProfileDocuments(
  ids: readonly string[],
): Promise<SyncResult> {
  const meili: Meilisearch | null = getMeiliClient()
  if (!meili) return DISABLED
  const clean = [...new Set(ids.filter((id) => typeof id === 'string' && id))]
  if (clean.length === 0) return { enabled: true, indexed: 0, deleted: 0 }
  try {
    const t = await meili.index(profileIndexUid()).deleteDocuments(clean)
    await awaitTask(meili, t.taskUid)
    logger.debug('Meili: profiles removed', { count: clean.length })
    return { enabled: true, indexed: 0, deleted: clean.length }
  } catch (e) {
    logger.error('Meili: document deletion failed', {
      count: clean.length,
      error: e instanceof Error ? e.message : String(e),
    })
    return { enabled: true, indexed: 0, deleted: 0 }
  }
}

/** §340 step 10 — full rebuild from the canonical view; never throws. */
export async function reindexProfiles(): Promise<{
  enabled: boolean
  indexed: number
  pages: number
  truncated: boolean
}> {
  const meili: Meilisearch | null = getMeiliClient()
  if (!meili) return { enabled: false, indexed: 0, pages: 0, truncated: false }
  const admin = getAdminSupabaseClient()
  if (!admin) {
    logger.error('Meili reindex skipped: admin client unavailable')
    return { enabled: false, indexed: 0, pages: 0, truncated: false }
  }
  const ensured = await ensureProfileIndex()
  if (!ensured.enabled || !ensured.uid)
    return { enabled: false, indexed: 0, pages: 0, truncated: false }
  const uid = ensured.uid
  let indexed = 0
  let pages = 0
  let truncated = false
  try {
    while (indexed < REINDEX_MAX_ROWS) {
      const from = pages * REINDEX_PAGE_SIZE
      const to = from + REINDEX_PAGE_SIZE - 1
      const { data, error } = await (
        admin as unknown as {
          from: (t: 'public_search_profiles') => {
            select: (c: string) => {
              range: (
                f: number,
                x: number,
              ) => Promise<{
                data: unknown
                error: { message: string } | null
              }>
            }
          }
        }
      )
        .from('public_search_profiles')
        .select('id, full_name, role, bio, skills, avatar_url, last_active_at')
        .range(from, to)
      if (error) {
        logger.error('Meili reindex: view read failed', {
          page: pages,
          error: error.message,
        })
        break
      }
      const rows = (data ?? []) as unknown as ProfileRow[]
      if (rows.length === 0) break
      const docs = toProfileSearchDocuments(rows)
      if (docs.length > 0) {
        const t = await meili
          .index(uid)
          .addDocuments(docs, { primaryKey: PROFILE_PRIMARY_KEY })
        await awaitTask(meili, t.taskUid)
        indexed += docs.length
      }
      pages += 1
      if (rows.length < REINDEX_PAGE_SIZE) break
    }
    if (indexed >= REINDEX_MAX_ROWS) {
      truncated = true
      logger.warn('Meili reindex hit the row ceiling', {
        ceiling: REINDEX_MAX_ROWS,
      })
    }
  } catch (e) {
    logger.error('Meili reindex failed', {
      indexed,
      pages,
      error: e instanceof Error ? e.message : String(e),
    })
  }
  logger.info('Meili reindex completed', { indexed, pages, truncated })
  return { enabled: true, indexed, pages, truncated }
}
