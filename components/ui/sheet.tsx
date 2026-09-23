'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

type SheetSide = 'right' | 'left' | 'bottom' | 'top'

export interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: SheetSide
  label?: string
  header?: ReactNode
  onClose?: () => void
  children?: ReactNode
}

const SIDE_CLASSES: Record<SheetSide, string> = {
  right:
    'right-0 top-0 h-full w-full max-w-md border-l border-[var(--cx-border-1)]',
  left: 'left-0 top-0 h-full w-full max-w-md border-r border-[var(--cx-border-1)]',
  bottom:
    'bottom-0 left-0 h-full max-h-[75vh] w-full border-t border-[var(--cx-border-1)]',
  top: 'top-0 left-0 h-full max-h-[75vh] w-full border-b border-[var(--cx-border-1)]',
}

export function Sheet({
  open: controlledOpen,
  onOpenChange,
  side = 'right',
  label,
  header,
  onClose,
  children,
}: SheetProps) {
  const isControlled = controlledOpen !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next)
      if (!next) onClose?.()
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange, onClose],
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, setOpen])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'cx-dialog-enter fixed flex flex-col border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] shadow-[var(--cx-shadow-dialog)]',
          SIDE_CLASSES[side],
        )}
      >
        {header && (
          <div className="flex items-start justify-between gap-4 border-b border-[var(--cx-border-1)] px-5 py-4">
            <div className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--cx-text-1)]">
              {header}
            </div>
            <button
              type="button"
              aria-label="Close sheet"
              onClick={() => setOpen(false)}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--cx-text-3)] transition hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)]"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
