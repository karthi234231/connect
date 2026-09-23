'use client'

import {
  createContext,
  useContext,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

type AccordionType = 'single' | 'multiple'

interface AccordionContextValue {
  openValues: Set<string>
  toggle: (value: string) => void
}

const AccordionContext = createContext<AccordionContextValue | null>(null)

function useAccordion() {
  const context = useContext(AccordionContext)
  if (!context) {
    throw new Error(
      'Accordion components must be rendered inside an <Accordion> root.',
    )
  }
  return context
}

interface AccordionItemContextValue {
  open: boolean
  value: string
  triggerId: string
  contentId: string
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(
  null,
)

function useAccordionItem() {
  const context = useContext(AccordionItemContext)
  if (!context) {
    throw new Error(
      'AccordionItem components must be used inside an <AccordionItem>.',
    )
  }
  return context
}

export interface AccordionProps {
  type?: AccordionType
  defaultValue?: string | string[]
  value?: string | string[]
  onValueChange?: (value: string | string[]) => void
  className?: string
  children?: ReactNode
}

function normalize(initial: string | string[] | undefined): Set<string> {
  if (initial === undefined) return new Set<string>()
  return new Set(Array.isArray(initial) ? initial : [initial])
}

function serialize(
  openValues: Set<string>,
  type: AccordionType,
): string | string[] {
  if (type === 'single') return [...openValues][0] ?? ''
  return [...openValues]
}

export function Accordion({
  type = 'single',
  defaultValue,
  value,
  onValueChange,
  className,
  children,
}: AccordionProps) {
  const isControlled = value !== undefined
  const [uncontrolled, setUncontrolled] = useState<Set<string>>(() =>
    normalize(defaultValue),
  )
  const openValues = isControlled ? normalize(value) : uncontrolled

  const toggle = (next: string) => {
    const updated = new Set(openValues)
    if (updated.has(next)) {
      updated.delete(next)
    } else {
      if (type === 'single') updated.clear()
      updated.add(next)
    }
    if (!isControlled) setUncontrolled(updated)
    onValueChange?.(serialize(updated, type))
  }

  return (
    <AccordionContext.Provider value={{ openValues, toggle }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  )
}

export interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string
  children?: ReactNode
}

export function AccordionItem({
  value,
  className,
  children,
  ...props
}: AccordionItemProps) {
  const { openValues } = useAccordion()
  const open = openValues.has(value)
  const triggerId = useId()
  const contentId = useId()

  return (
    <AccordionItemContext.Provider
      value={{ open, value, triggerId, contentId }}
    >
      <div
        className={cn(
          'border-b border-[var(--cx-border-1)] last:border-b-0',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  )
}

export type AccordionTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>

export function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionTriggerProps) {
  const { open, value, triggerId, contentId } = useAccordionItem()
  const { toggle } = useAccordion()

  return (
    <button
      type="button"
      id={triggerId}
      aria-expanded={open}
      aria-controls={contentId}
      onClick={() => toggle(value)}
      className={cn(
        'flex w-full items-center justify-between gap-3 px-1 py-3 text-left text-sm font-medium text-[var(--cx-text-1)] transition select-none',
        'outline-none focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cx-surface-1)]',
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      <ChevronDown
        className={cn(
          'size-4 shrink-0 text-[var(--cx-text-3)] transition-transform duration-200',
          open && 'rotate-180',
        )}
      />
    </button>
  )
}

export type AccordionContentProps = HTMLAttributes<HTMLDivElement>

export function AccordionContent({
  className,
  children,
  ...props
}: AccordionContentProps) {
  const { open, contentId, triggerId } = useAccordionItem()

  return (
    <div
      id={contentId}
      role="region"
      aria-labelledby={triggerId}
      className={cn(
        'grid overflow-hidden transition-[grid-template-rows] duration-200',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        className,
      )}
      {...props}
    >
      <div aria-hidden={!open} className="min-h-0 overflow-hidden">
        <div className="px-1 pb-4 pt-1 text-sm leading-6 text-[var(--cx-text-3)]">
          {children}
        </div>
      </div>
    </div>
  )
}
