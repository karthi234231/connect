'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface DateFieldProps {
  value: Date | null
  onChange: (date: Date) => void
  label?: string
  placeholder?: string
  minDate?: Date
  maxDate?: Date
  disabled?: boolean
  className?: string
}

const dayFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const monthFormatter = new Intl.DateTimeFormat('en-GB', { month: 'long' })
const weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getMonthCells(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7))
  const cells: Date[] = []
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    cells.push(date)
  }
  return cells
}

export function DateField({
  value,
  onChange,
  label,
  placeholder = 'Pick a date',
  minDate,
  maxDate,
  disabled = false,
  className,
}: DateFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    startOfMonth(value ?? new Date()),
  )

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const days = useMemo(
    () => getMonthCells(viewMonth.getFullYear(), viewMonth.getMonth()),
    [viewMonth],
  )
  const monthName = monthFormatter.format(viewMonth)
  const today = startOfDay(new Date())

  const minDay = minDate ? startOfDay(minDate) : null
  const maxDay = maxDate ? startOfDay(maxDate) : null
  const prevMonthDisabled =
    !!minDay &&
    viewMonth.getFullYear() === minDay.getFullYear() &&
    viewMonth.getMonth() === minDay.getMonth()
  const nextMonthDisabled =
    !!maxDay &&
    viewMonth.getFullYear() === maxDay.getFullYear() &&
    viewMonth.getMonth() === maxDay.getMonth()

  const isDayDisabled = (date: Date): boolean => {
    if (minDay && date < minDay) return true
    if (maxDay && date > maxDay) return true
    return false
  }

  const handleTriggerClick = () => {
    if (disabled) return
    setViewMonth(startOfMonth(value ?? new Date()))
    setOpen((current) => !current)
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {label ? (
        <label className="mb-1.5 block text-xs font-medium text-[var(--cx-text-3)]">
          {label}
        </label>
      ) : null}
      <button
        type="button"
        onClick={handleTriggerClick}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--cx-brand)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          className={cn(
            'truncate text-left',
            value ? 'text-[var(--cx-text-1)]' : 'text-[var(--cx-text-4)]',
          )}
        >
          {value ? dayFormatter.format(value) : placeholder}
        </span>
        <CalendarDays
          className="size-4 shrink-0 text-[var(--cx-text-4)]"
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={`${monthName} ${viewMonth.getFullYear()}`}
          className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-3 shadow-[var(--cx-shadow-md)]"
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <button
              type="button"
              onClick={() =>
                setViewMonth(
                  new Date(
                    viewMonth.getFullYear(),
                    viewMonth.getMonth() - 1,
                    1,
                  ),
                )
              }
              disabled={prevMonthDisabled}
              aria-label="Previous month"
              className="flex size-7 items-center justify-center rounded-full text-[var(--cx-text-3)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)] focus-visible:outline-2 focus-visible:outline-[var(--cx-brand)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <span className="text-sm font-medium text-[var(--cx-text-1)]">
              {monthName} {viewMonth.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() =>
                setViewMonth(
                  new Date(
                    viewMonth.getFullYear(),
                    viewMonth.getMonth() + 1,
                    1,
                  ),
                )
              }
              disabled={nextMonthDisabled}
              aria-label="Next month"
              className="flex size-7 items-center justify-center rounded-full text-[var(--cx-text-3)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)] focus-visible:outline-2 focus-visible:outline-[var(--cx-brand)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div
            role="grid"
            aria-label={`Choose date in ${monthName} ${viewMonth.getFullYear()}`}
          >
            <div role="row" className="grid grid-cols-7" aria-hidden="true">
              {weekdayLabels.map((weekday, index) => (
                <span
                  key={`${weekday}-${index}`}
                  className="flex h-7 items-center justify-center text-[10px] text-[var(--cx-text-4)]"
                >
                  {weekday}
                </span>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, weekIndex) => (
              <div key={weekIndex} role="row" className="grid grid-cols-7">
                {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((date) => {
                  const inMonth =
                    date.getFullYear() === viewMonth.getFullYear() &&
                    date.getMonth() === viewMonth.getMonth()
                  const selected = value ? isSameDay(date, value) : false
                  const isToday = isSameDay(date, today)
                  const dayDisabled = isDayDisabled(date)
                  return (
                    <div
                      key={date.toISOString()}
                      role="gridcell"
                      aria-selected={selected}
                      className="flex justify-center p-0.5"
                    >
                      <button
                        type="button"
                        onClick={() => !dayDisabled && onChange(date)}
                        disabled={dayDisabled}
                        aria-disabled={dayDisabled}
                        className={cn(
                          'flex size-9 items-center justify-center rounded-full text-xs focus-visible:outline-2 focus-visible:outline-[var(--cx-brand)] disabled:cursor-not-allowed disabled:opacity-40',
                          selected
                            ? 'bg-[var(--cx-brand)] font-medium text-white'
                            : 'text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)]',
                          !selected &&
                            isToday &&
                            'ring-1 ring-[var(--cx-brand)]',
                          !inMonth && 'opacity-50',
                        )}
                      >
                        {date.getDate()}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
