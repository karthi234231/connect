'use client'

import {
  createContext,
  useContext,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '@/utils/cn'

interface TabsContextValue {
  value: string
  setValue: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be rendered inside a <Tabs> root.')
  }
  return context
}

export interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  children?: ReactNode
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
}: TabsProps) {
  const isControlled = value !== undefined
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? '')
  const selected = isControlled ? (value ?? '') : uncontrolled

  const setValue = (next: string) => {
    if (!isControlled) setUncontrolled(next)
    onValueChange?.(next)
  }

  return (
    <TabsContext.Provider value={{ value: selected, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export type TabsListProps = HTMLAttributes<HTMLDivElement>

export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn('flex flex-wrap items-center gap-1', className)}
      {...props}
    />
  )
}

export interface TabsTriggerProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'value'
> {
  value: string
}

export function TabsTrigger({ value, className, ...props }: TabsTriggerProps) {
  const { value: selected, setValue } = useTabsContext()
  const active = selected === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => setValue(value)}
      className={cn(
        'rounded-full px-2.5 py-1 text-[11px] transition select-none',
        active
          ? 'bg-[var(--cx-brand-soft)] font-medium text-[var(--cx-brand-strong)]'
          : 'text-[var(--cx-text-3)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]',
        className,
      )}
      {...props}
    />
  )
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
}

export function TabsContent({ value, className, ...props }: TabsContentProps) {
  const { value: selected } = useTabsContext()
  if (selected !== value) return null

  return <div role="tabpanel" className={className} {...props} />
}
