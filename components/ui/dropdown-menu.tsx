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

interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null)

function useDropdownMenu() {
  const context = useContext(DropdownMenuContext)
  if (!context) {
    throw new Error(
      'DropdownMenu components must be rendered inside a <DropdownMenu> root.',
    )
  }
  return context
}

export interface DropdownMenuProps {
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DropdownMenu({
  children,
  open: controlledOpen,
  onOpenChange,
}: DropdownMenuProps) {
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
    <DropdownMenuContext.Provider value={providerValue}>
      <div className="relative inline-flex">{children}</div>
    </DropdownMenuContext.Provider>
  )
}

export type DropdownMenuTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>

export function DropdownMenuTrigger({
  children,
  onClick,
  ...props
}: DropdownMenuTriggerProps) {
  const { triggerRef, open, setOpen } = useDropdownMenu()
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
      aria-haspopup="menu"
      aria-expanded={open}
      {...props}
    >
      {children}
    </button>
  )
}

export type DropdownMenuContentProps = HTMLAttributes<HTMLDivElement>

export function DropdownMenuContent({
  children,
  className,
  ...props
}: DropdownMenuContentProps) {
  const { open, setOpen, triggerRef } = useDropdownMenu()
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
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
      role="menu"
      data-dropdown-content
      className={cn(
        'cx-dialog-enter absolute top-full right-0 z-50 mt-2 min-w-[12rem] rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] py-1.5 shadow-[var(--cx-shadow-elevated)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
