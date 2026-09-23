'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface DialogContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = createContext<DialogContextValue | null>(null)

function useDialogContext() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error(
      'Dialog components must be rendered inside a <Dialog> root.',
    )
  }
  return context
}

export interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
}

export function Dialog({
  open: controlledOpen,
  onOpenChange,
  children,
}: DialogProps) {
  const isControlled = controlledOpen !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

export type DialogTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>

export function DialogTrigger({ onClick, ...props }: DialogTriggerProps) {
  const { setOpen } = useDialogContext()

  return (
    <button
      type="button"
      onClick={(event) => {
        onClick?.(event)
        setOpen(true)
      }}
      {...props}
    />
  )
}

export type DialogContentProps = HTMLAttributes<HTMLDivElement>

export function DialogContent({
  className,
  children,
  ...props
}: DialogContentProps) {
  const { open, setOpen } = useDialogContext()

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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-md cx-fade-in p-4"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'cx-scale-up fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[var(--cx-glass-border)] bg-[var(--cx-surface-2)]/95 backdrop-blur-xl p-6 shadow-[var(--cx-shadow-dialog)] focus-visible:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

export interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children?: ReactNode
}

export function DialogTitle({ className, ...props }: DialogTitleProps) {
  return (
    <h2
      className={cn(
        'font-display text-xl font-semibold tracking-[-0.02em] text-[var(--cx-text-1)]',
        className,
      )}
      {...props}
    />
  )
}

export interface DialogDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children?: ReactNode
}

export function DialogDescription({
  className,
  ...props
}: DialogDescriptionProps) {
  return (
    <p
      className={cn(
        'mt-1.5 text-sm leading-5 text-[var(--cx-text-3)]',
        className,
      )}
      {...props}
    />
  )
}

export type DialogCloseProps = ButtonHTMLAttributes<HTMLButtonElement>

export function DialogClose({
  className,
  children,
  onClick,
  ...props
}: DialogCloseProps) {
  const { setOpen } = useDialogContext()

  return (
    <button
      type="button"
      aria-label="Close dialog"
      onClick={(event) => {
        onClick?.(event)
        setOpen(false)
      }}
      className={cn(
        'absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-[var(--cx-text-3)] transition-all duration-200 hover:scale-105 active:scale-95 hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)]',
        className,
      )}
      {...props}
    >
      {children ?? <X className="size-4" />}
    </button>
  )
}
