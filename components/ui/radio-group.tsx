'use client'

import {
  createContext,
  useContext,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { cn } from '@/utils/cn'

interface RadioGroupContextValue {
  value: string
  onSelect: (value: string) => void
  disabled?: boolean
  groupRef: RefObject<HTMLDivElement | null>
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null)

function useRadioGroupContext() {
  const context = useContext(RadioGroupContext)
  if (!context) {
    throw new Error(
      'RadioGroup components must be rendered inside a <RadioGroup>.',
    )
  }
  return context
}

export interface RadioGroupProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  value: string
  onValueChange?: (value: string) => void
  orientation?: 'vertical' | 'horizontal'
  disabled?: boolean
}

export function RadioGroup({
  value,
  onValueChange,
  orientation = 'vertical',
  disabled = false,
  className,
  children,
  ...props
}: RadioGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null)

  return (
    <RadioGroupContext.Provider
      value={{
        value,
        onSelect: (next) => onValueChange?.(next),
        disabled,
        groupRef,
      }}
    >
      <div
        ref={groupRef}
        role="radiogroup"
        aria-disabled={disabled || undefined}
        className={cn(
          'flex gap-2',
          orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

export interface RadioGroupItemProps {
  value: string
  label?: ReactNode
  disabled?: boolean
}

export function RadioGroupItem({
  value,
  label,
  disabled = false,
}: RadioGroupItemProps) {
  const {
    value: selectedValue,
    onSelect,
    disabled: groupDisabled,
    groupRef,
  } = useRadioGroupContext()
  const selected = selectedValue === value
  const isDisabled = disabled || groupDisabled

  const getItems = () =>
    Array.from(
      groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ??
        [],
    )

  const pickItem = (item: HTMLButtonElement) => {
    const nextValue = item.dataset.value
    if (nextValue) onSelect(nextValue)
    item.focus()
  }

  const focusInDirection = (currentIndex: number, direction: number) => {
    const items = getItems()
    for (
      let i = currentIndex + direction;
      i >= 0 && i < items.length;
      i += direction
    ) {
      const item = items[i]
      if (!item.disabled) {
        pickItem(item)
        return
      }
    }
  }

  const focusEdge = (edge: 'home' | 'end') => {
    const items = getItems()
    const sequence = edge === 'home' ? items : [...items].reverse()
    for (const item of sequence) {
      if (!item.disabled) {
        pickItem(item)
        return
      }
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const items = getItems()
    const currentIndex = items.indexOf(event.currentTarget)
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        focusInDirection(currentIndex, 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        focusInDirection(currentIndex, -1)
        break
      case 'Home':
        event.preventDefault()
        focusEdge('home')
        break
      case 'End':
        event.preventDefault()
        focusEdge('end')
        break
    }
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={typeof label === 'string' ? undefined : value}
      disabled={isDisabled}
      data-value={value}
      onClick={() => onSelect(value)}
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex items-center gap-2 rounded-full text-sm select-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)] focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition',
          selected ? 'border-[var(--cx-brand)]' : 'border-[var(--cx-border-2)]',
        )}
      >
        {selected && (
          <span className="size-2 rounded-full bg-[var(--cx-brand)]" />
        )}
      </span>
      {label && <span className="text-[var(--cx-text-1)]">{label}</span>}
    </button>
  )
}
