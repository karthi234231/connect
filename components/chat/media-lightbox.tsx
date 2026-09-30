'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Download, ExternalLink, X } from 'lucide-react'

export interface MediaLightboxProps {
  src: string
  alt?: string
  isOpen: boolean
  onClose: () => void
}

export function MediaLightbox({
  src,
  alt = 'Media preview',
  isOpen,
  onClose,
}: MediaLightboxProps): ReactNode {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!isOpen) return

    previousFocusRef.current = document.activeElement as HTMLElement | null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'),
      )
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const activeElement = document.activeElement as HTMLElement | null
      const isOnFirst = activeElement === first
      const isOnLast = activeElement === last
      const isOutside = activeElement === null || !focusables.includes(activeElement)

      if (event.shiftKey) {
        if (isOnFirst || isOutside) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (isOnLast || isOutside) {
        event.preventDefault()
        first.focus()
      }
    }

    closeButtonRef.current?.focus()

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center overflow-hidden rounded-2xl bg-[var(--cx-surface-1)] p-2 shadow-2xl sm:p-4">
        {/* Top Control Bar */}
        <div className="flex w-full items-center justify-between gap-3 pb-3 px-2">
          <p className="max-w-[280px] truncate text-xs font-medium text-[var(--cx-text-2)] sm:max-w-md">
            {alt}
          </p>
          <div className="flex items-center gap-2">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              download
              title="Download media"
              className="flex size-8 items-center justify-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]"
            >
              <Download className="size-4" />
            </a>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              className="flex size-8 items-center justify-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]"
            >
              <ExternalLink className="size-4" />
            </a>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close image preview"
              className="flex size-8 items-center justify-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Media Container */}
        <div className="flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[75vh] max-w-full object-contain transition-transform duration-200"
          />
        </div>
      </div>
    </div>
  )
}
