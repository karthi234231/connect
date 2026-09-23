'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/utils/cn'

type PopoverSide = 'top' | 'bottom' | 'left' | 'right'
type PopoverAlign = 'start' | 'center' | 'end'

interface PopoverContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const PopoverContext = createContext<PopoverContextValue | null>(null)

function usePopover() {
  const context = useContext(PopoverContext)
  if (!context) {
    throw new Error(
      'Popover components must be rendered inside a <Popover> root.',
    )
  }
  return context
}

export interface PopoverProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

export function Popover({
  open: controlledOpen,
  onOpenChange,
  children,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = useCallback(
    (next: boolean) => {
      setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  const providerValue = useMemo(
    () => ({ open, setOpen, triggerRef }),
    [open, setOpen],
  )
  return (
    <PopoverContext.Provider value={providerValue}>
      <div className="relative inline-flex">{children}</div>
    </PopoverContext.Provider>
  )
}

export type PopoverTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>

export function PopoverTrigger({
  children,
  onClick,
  ...props
}: PopoverTriggerProps) {
  const { triggerRef, open, setOpen } = usePopover()
  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      if (!event.defaultPrevented) setOpen(!open)
    },
    [onClick, setOpen, open],
  )
  return (
    <button
      type="button"
      ref={triggerRef}
      onClick={handleClick}
      aria-haspopup="dialog"
      aria-expanded={open}
      {...props}
    >
      {children}
    </button>
  )
}

export interface PopoverContentProps extends HTMLAttributes<HTMLDivElement> {
  side?: PopoverSide
  align?: PopoverAlign
}

const SIDE_ALIGN_CLASSES: Record<PopoverSide, Record<PopoverAlign, string>> = {
  top: {
    start: 'bottom-full left-0 mb-2',
    center: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
    end: 'bottom-full right-0 mb-2',
  },
  bottom: {
    start: 'top-full left-0 mt-2',
    center: 'top-full left-1/2 mt-2 -translate-x-1/2',
    end: 'top-full right-0 mt-2',
  },
  left: {
    start: 'right-full top-0 mr-2',
    center: 'right-full top-1/2 mr-2 -translate-y-1/2',
    end: 'right-full bottom-0 mr-2',
  },
  right: {
    start: 'left-full top-0 ml-2',
    center: 'left-full top-1/2 ml-2 -translate-y-1/2',
    end: 'left-full bottom-0 ml-2',
  },
}

export function PopoverContent({
  side = 'bottom',
  align = 'center',
  className,
  children,
  ...props
}: PopoverContentProps) {
  const { open, setOpen, triggerRef } = usePopover()
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        contentRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, setOpen, triggerRef])

  if (!open) return null

  return (
    <div
      ref={contentRef}
      role="dialog"
      className={cn(
        'cx-dialog-enter absolute z-50 w-max min-w-[12rem] rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-2 shadow-[var(--cx-shadow-elevated)]',
        SIDE_ALIGN_CLASSES[side][align],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
