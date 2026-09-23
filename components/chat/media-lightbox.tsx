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
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
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
