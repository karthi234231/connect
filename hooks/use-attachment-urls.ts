'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { fetchAttachmentUrl } from '@/client/api/chat'
import { ATTACHMENT_PATH_PATTERN } from '@/lib/chat/attachment'
import { logger } from '@/lib/logger'

export interface AttachmentSignedUrlState {
  url: string | null
  isLoading: boolean
  error: unknown
}

interface CachedSignedUrl {
  url: string
  expiresAt: number
}

/**
 * PATH-vs-SIGNED-URL CONTRACT
 *
 * A message's `attachment_url` (`MessageSummary.attachment_url`) is a canonical
 * STORAGE PATH inside the private `match-attachments` bucket, shaped
 * `match-attachments/{matchId}/{uuid}.{ext}`. It is a storage KEY, never a
 * URL — rendering it directly (`<img src={path}>`) always 404s. The only way
 * to display it is to resolve it through `fetchAttachmentUrl(path)`
 * (`client/api/chat.ts`), which server-asserts thread access and mints a
 * short-lived signed READ URL (≈5 min TTL,
 * `SIGNED_URL_TTL_SECONDS` = 300 in `services/chat/chat.service.ts`).
 *
 * This module owns that resolution: it caches signed URLs with a min-TTL (with
 * headroom so a cached URL is never served past its server-side window),
 * dedupes concurrent in-flight requests per path, fails fast on invalid paths,
 * and never throws to the UI. Every chat surface that renders an attachment
 * (message bubbles, file chips, lightbox, composer preview, thread view) goes
 * through `useAttachmentSignedUrl` / `useAttachmentSignedUrls` — never by
 * rendering the path directly and never by calling the server action per
 * message per render.
 */

const MAX_CACHE_SIGNED_URL_TTL = 270_000 // 4.5 min — headroom under the server's 5-min TTL

const RESOLUTION_ERROR = new Error('Attachment URL could not be resolved.')

const urlCache = new Map<string, CachedSignedUrl>()
const inflight = new Map<string, Promise<string>>()

function isRenderableSignedUrl(path: string): boolean {
  return ATTACHMENT_PATH_PATTERN.test(path)
}

/**
 * Resolve a canonical attachment storage `path` into a renderable signed URL.
 *
 * - Fails fast: empty or non-canonical paths (`!isValidAttachmentPath`) resolve
 *   to `''` without any server call.
 * - Caches per path for the server TTL minus headroom, so hot re-reads (the
 *   same message bubble re-rendering) never hit the server again.
 * - Dedupes: concurrent calls for one path share a single in-flight request.
 * - Never throws: any failure resolves to `''` and is logged via the shared
 *   client-safe logger (`lib/logger`); callers treat `''` as unrenderable.
 * - SSR-safe: guarded on `typeof window`, so it is inert outside the browser
 *   (the server action boundary must never be touched from a server pass).
 */
export async function getSignedAttachmentUrl(path: string): Promise<string> {
  if (typeof window === 'undefined') return ''
  if (!path || !isRenderableSignedUrl(path)) return ''

  const now = Date.now()
  const cached = urlCache.get(path)
  if (cached !== undefined && cached.expiresAt > now) return cached.url

  const pending = inflight.get(path)
  if (pending !== undefined) return pending

  const promise = fetchAttachmentUrl(path)
    .then((url) => {
      urlCache.set(path, { url, expiresAt: now + MAX_CACHE_SIGNED_URL_TTL })
      return url
    })
    .catch((cause: unknown) => {
      logger.error('getSignedAttachmentUrl: could not resolve attachment path', { path }, cause)
      return ''
    })

  inflight.set(path, promise)
  try {
    return await promise
  } finally {
    inflight.delete(path)
  }
}

/**
 * Resolve a single attachment path into a signed URL with loading/error state.
 *
 * - `url` is `null` when `path` is empty/`undefined` (nothing to render) and
 *   while the resolution is pending; it holds the renderable signed URL once
 *   resolved.
 * - `isLoading` reports an in-flight (or not-yet-resolved) request and is
 *   `false` for an empty path.
 * - `error` is set when resolution fails (never thrown to the UI).
 *
 * Resolution runs on mount and whenever `path` changes, backed by the module
 * cache so repeated mounts for the same path stay cheap.
 */
export function useAttachmentSignedUrl(path?: string | null): AttachmentSignedUrlState {
  const [resolved, setResolved] = useState<{
    path: string
    url: string
    error: unknown
  } | null>(null)

  useEffect(() => {
    if (!path) return

    let cancelled = false
    void getSignedAttachmentUrl(path).then((url) => {
      if (cancelled) return
      setResolved({
        path,
        url,
        error: url ? null : RESOLUTION_ERROR,
      })
    })

    return () => {
      cancelled = true
    }
  }, [path])

  const current = path ? (resolved?.path === path ? resolved : null) : null

  return {
    url: current?.url ?? null,
    isLoading: path ? current === null : false,
    error: current?.error ?? null,
  }
}

/**
 * Batch variant for message lists: resolve every unique non-empty path in a
 * single resolution pass and return one `AttachmentSignedUrlState` per path.
 *
 * The record is memoized keyed by the resolved-urls map plus `paths` identity,
 * so consumers receive a stable object reference until an actual member value
 * changes (no re-render storms while children re-render for other reasons).
 * Each path is requested at most once per mount; the module cache and in-flight
 * dedupe keep repeated batches cheap.
 */
export function useAttachmentSignedUrls(
  paths: Array<string | null | undefined>,
): Record<string, AttachmentSignedUrlState> {
  const activePaths = useMemo(() => {
    const seen = new Set<string>()
    const unique: string[] = []
    for (const path of paths) {
      if (path && !seen.has(path)) {
        seen.add(path)
        unique.push(path)
      }
    }
    return unique
  }, [paths])

  const [urlsByPath, setUrlsByPath] = useState<Record<string, string>>({})
  const [errorsByPath, setErrorsByPath] = useState<Record<string, unknown>>({})

  const requestedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const toFetch = activePaths.filter((path) => !requestedRef.current.has(path))
    if (toFetch.length === 0) return
    for (const path of toFetch) requestedRef.current.add(path)

    let alive = true
    void Promise.all(
      toFetch.map(async (path) => {
        const resolved = await getSignedAttachmentUrl(path)
        if (!alive) return
        if (resolved) {
          setUrlsByPath((prev) =>
            prev[path] === resolved ? prev : { ...prev, [path]: resolved },
          )
        } else {
          setErrorsByPath((prev) =>
            path in prev ? prev : { ...prev, [path]: RESOLUTION_ERROR },
          )
        }
      }),
    )
    return () => {
      alive = false
    }
  }, [activePaths])

  return useMemo(() => {
    const record: Record<string, AttachmentSignedUrlState> = {}
    for (const path of activePaths) {
      const url = urlsByPath[path]
      const error = errorsByPath[path]
      if (url !== undefined) {
        record[path] = { url, isLoading: false, error: null }
      } else if (error !== undefined) {
        record[path] = { url: null, isLoading: false, error }
      } else {
        record[path] = { url: null, isLoading: true, error: null }
      }
    }
    return record
  }, [activePaths, urlsByPath, errorsByPath])
}