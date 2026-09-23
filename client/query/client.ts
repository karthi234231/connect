import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

interface CacheEntry<T> {
  data: T
  updatedAt: number
}

export interface QueryClient {
  get: <T>(key: string) => T | undefined
  set: <T>(key: string, data: T) => void
  invalidate: (keys: string[] | string) => void
  remove: (key: string) => void
  clear: () => void
}

const cache = new Map<string, CacheEntry<unknown>>()
const listeners = new Set<() => void>()
let version = 0

function notify(): void {
  version += 1
  listeners.forEach((listener) => listener())
}

export const queryClient: QueryClient = {
  get: <T>(key: string) => cache.get(key)?.data as T | undefined,
  set: <T>(key: string, data: T) => {
    cache.set(key, { data, updatedAt: Date.now() })
    notify()
  },
  invalidate: (keys: string[] | string) => {
    const list = Array.isArray(keys) ? keys : [keys]
    for (const key of list) cache.delete(key)
    notify()
  },
  remove: (key: string) => {
    cache.delete(key)
    notify()
  },
  clear: () => {
    cache.clear()
    notify()
  },
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

function getVersion(): number {
  return version
}

export interface QueryResult<T> {
  data: T | undefined
  isLoading: boolean
  error: unknown
  refetch: () => Promise<void>
}

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
): QueryResult<T> {
  useSyncExternalStore(subscribe, getVersion, getVersion)

  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const [isLoading, setIsLoading] = useState(
    queryClient.get<T>(key) === undefined,
  )
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (queryClient.get<T>(key) !== undefined) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const data = await fetcherRef.current()
        if (!cancelled) queryClient.set(key, data)
      } catch (err) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [key])

  const data = queryClient.get<T>(key)

  const refetch = async () => {
    setError(null)
    try {
      const fresh = await fetcherRef.current()
      queryClient.set(key, fresh)
    } catch (err) {
      setError(err)
    }
  }

  return { data, isLoading, error, refetch }
}
