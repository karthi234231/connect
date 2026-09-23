'use client'

import { useEffect, useState, useCallback } from 'react'
import { showSuccessToast } from '@/lib/toast'

const BOOKMARKS_STORAGE_KEY = 'connect_bookmarked_ideas'
const BOOKMARK_EVENT = 'connect_idea_bookmark_changed'

function getBookmarkedIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const item = window.localStorage.getItem(BOOKMARKS_STORAGE_KEY)
    return item ? (JSON.parse(item) as string[]) : []
  } catch {
    return []
  }
}

export function useIdeaBookmark(ideaId: string, initialIsBookmarked?: boolean) {
  const [isBookmarked, setIsBookmarked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return initialIsBookmarked ?? false
    const ids = getBookmarkedIds()
    if (ids.includes(ideaId)) return true
    return initialIsBookmarked ?? false
  })

  useEffect(() => {
    const handleBookmarkChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ ideaId: string; bookmarked: boolean }>
      if (customEvent.detail && customEvent.detail.ideaId === ideaId) {
        setIsBookmarked(customEvent.detail.bookmarked)
      }
    }

    window.addEventListener(BOOKMARK_EVENT, handleBookmarkChange)
    return () => {
      window.removeEventListener(BOOKMARK_EVENT, handleBookmarkChange)
    }
  }, [ideaId])

  const toggleBookmark = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation()
      const ids = getBookmarkedIds()
      const currentlyBookmarked = ids.includes(ideaId) || isBookmarked
      const nextBookmarked = !currentlyBookmarked

      let updatedIds: string[]
      if (nextBookmarked) {
        updatedIds = Array.from(new Set([...ids, ideaId]))
        showSuccessToast('Idea saved to bookmarks')
      } else {
        updatedIds = ids.filter((id) => id !== ideaId)
        showSuccessToast('Removed from bookmarks')
      }

      try {
        window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updatedIds))
      } catch {}

      setIsBookmarked(nextBookmarked)

      window.dispatchEvent(
        new CustomEvent(BOOKMARK_EVENT, {
          detail: { ideaId, bookmarked: nextBookmarked },
        }),
      )

      return nextBookmarked
    },
    [ideaId, isBookmarked],
  )

  return {
    isBookmarked,
    toggleBookmark,
  }
}
