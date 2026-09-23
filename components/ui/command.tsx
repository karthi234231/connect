'use client'

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface CommandItem {
  id: string
  label: string
  hint?: string
  group?: string
  icon?: ReactNode
  keywords?: string[]
}

export interface CommandDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title?: ReactNode
  placeholder?: string
  items: CommandItem[]
  onSelect?: (item: CommandItem) => void
  children?: ReactNode
}

interface GroupedItem {
  group: string
  items: CommandItem[]
}

export function CommandDialog({
  open: controlledOpen,
  onOpenChange,
  title,
  placeholder,
  items,
  onSelect,
  children,
}: CommandDialogProps) {
  const isControlled = controlledOpen !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [prevOpen, setPrevOpen] = useState(controlledOpen ?? false)
  const open = isControlled ? controlledOpen : uncontrolledOpen
  if (open !== prevOpen) {
    setPrevOpen(open)
    setQuery('')
    setActiveIndex(0)
  }
  const listId = useId()

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = [item.label, ...(item.keywords ?? [])]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [items, query])

  const grouped = useMemo(() => {
    const result: GroupedItem[] = []
    for (const item of filtered) {
      const name = item.group ?? 'General'
      const existing = result.find((group) => group.group === name)
      if (existing) {
        existing.items.push(item)
      } else {
        result.push({ group: name, items: [item] })
      }
    }
    return result
  }, [filtered])

  const selectItem = useCallback(
    (item: CommandItem) => {
      onSelect?.(item)
      setQuery('')
      setActiveIndex(0)
      setOpen(false)
    },
    [onSelect, setOpen],
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) =>
          filtered.length === 0 ? 0 : (index + 1) % filtered.length,
        )
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((index) =>
          filtered.length === 0
            ? 0
            : (index - 1 + filtered.length) % filtered.length,
        )
      } else if (event.key === 'Enter') {
        const item = filtered[activeIndex]
        if (item) {
          event.preventDefault()
          selectItem(item)
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, filtered, activeIndex, selectItem, setOpen])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className="cx-dialog-enter fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[var(--cx-border-2)] bg-[var(--cx-surface-1)] p-2 shadow-[var(--cx-shadow-dialog)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--cx-border-1)] px-3 pb-2 pt-1">
          {title !== undefined && (
            <h2 className="font-display text-base font-semibold tracking-[-0.02em] text-[var(--cx-text-1)]">
              {title}
            </h2>
          )}
          <kbd className="rounded-md border border-[var(--cx-border-1)] bg-[var(--cx-surface-3)] px-1.5 py-0.5 font-medium text-[10px] text-[var(--cx-text-4)] shadow-[inset_0_-1px_0_var(--cx-border-2)]">
            ⌘ K
          </kbd>
        </div>

        <div className="relative flex items-center px-3 py-2.5">
          <Search className="pointer-events-none absolute left-3.5 size-4 text-[var(--cx-text-3)]" />
          <input
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label="Search commands"
            aria-activedescendant={
              activeIndex >= 0 ? filtered[activeIndex]?.id : undefined
            }
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            placeholder={placeholder ?? 'Type a command or search…'}
            className="w-full bg-transparent pl-8 pr-2 text-sm text-[var(--cx-text-1)] outline-none placeholder:text-[var(--cx-text-4)]"
          />
        </div>

        <div
          id={listId}
          role="listbox"
          aria-label="Command results"
          className="max-h-80 overflow-y-auto px-1.5 pb-1.5"
        >
          {grouped.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-[var(--cx-text-4)]">
              No results found
            </p>
          ) : (
            grouped.map(({ group, items: groupItems }) => (
              <div key={group}>
                <p className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                  {group}
                </p>
                {groupItems.map((item) => {
                  const flatIndex = filtered.indexOf(item)
                  const active = flatIndex === activeIndex
                  return (
                    <button
                      key={item.id}
                      type="button"
                      id={item.id}
                      role="option"
                      aria-selected={active}
                      onClick={() => selectItem(item)}
                      onMouseMove={() => setActiveIndex(flatIndex)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-[var(--cx-text-1)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)]',
                        active &&
                          'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]',
                      )}
                    >
                      {item.icon && (
                        <span className="flex shrink-0 items-center text-[var(--cx-text-3)]">
                          {item.icon}
                        </span>
                      )}
                      <span className="truncate">{item.label}</span>
                      {item.hint && (
                        <span className="ml-auto shrink-0 text-xs text-[var(--cx-text-4)]">
                          {item.hint}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {children}
      </div>
    </div>
  )
}
