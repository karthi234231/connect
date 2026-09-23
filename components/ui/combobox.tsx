'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface ComboboxOption {
  value: string
  label: string
}

export interface ComboboxProps {
  options: ComboboxOption[]
  value: string | null
  onChange?: (value: string) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  emptyText,
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setQuery('')
    setActiveIndex(0)
  }
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const listId = `${id}-listbox`

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => option.label.toLowerCase().includes(q))
  }, [options, query])

  const select = useCallback(
    (option: ComboboxOption) => {
      onChange?.(option.value)
      setOpen(false)
      setQuery('')
      setActiveIndex(0)
    },
    [onChange],
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
        const option = filtered[activeIndex]
        if (option) {
          event.preventDefault()
          select(option)
        }
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        dropdownRef.current?.contains(target) ||
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
  }, [open, filtered, activeIndex, select])

  const activeId =
    open && activeIndex >= 0 && filtered[activeIndex]
      ? `${id}-option-${filtered[activeIndex].value}`
      : undefined

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-activedescendant={activeId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 text-sm transition',
          'outline-none focus:border-[var(--cx-brand)] focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          open && 'border-[var(--cx-brand)]',
        )}
      >
        <span
          className={cn(
            'truncate text-left',
            value === null && 'text-[var(--cx-text-4)]',
          )}
        >
          {selected?.label ?? placeholder ?? 'Select…'}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value !== null && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              onClick={(event) => {
                event.stopPropagation()
                onChange?.('')
              }}
              className="rounded-full p-0.5 text-[var(--cx-text-3)] hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'size-4 text-[var(--cx-text-3)] transition-transform',
              open && 'rotate-180',
            )}
          />
        </span>
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="cx-dialog-enter absolute left-0 right-0 z-50 mt-2 rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-1.5 shadow-[var(--cx-shadow-elevated)]"
        >
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            placeholder="Type to filter…"
            aria-label="Filter options"
            className="w-full rounded-lg border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2.5 py-1.5 text-sm outline-none placeholder:text-[var(--cx-text-4)] focus:border-[var(--cx-brand)]"
          />
          <div
            id={listId}
            role="listbox"
            aria-label="Options"
            className="mt-1 max-h-56 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-sm text-[var(--cx-text-4)]">
                {emptyText ?? 'No options'}
              </p>
            ) : (
              filtered.map((option, index) => {
                const isActive = index === activeIndex
                const isSelected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    id={`${id}-option-${option.value}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => select(option)}
                    className={cn(
                      'flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)]',
                      isActive && 'bg-[var(--cx-brand-soft)]',
                      isSelected
                        ? 'font-medium text-[var(--cx-brand-strong)]'
                        : 'text-[var(--cx-text-1)]',
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
