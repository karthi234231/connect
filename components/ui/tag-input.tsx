'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  suggestions?: string[]
  maxTags?: number
  disabled?: boolean
}

export function TagInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
  maxTags,
  disabled = false,
}: TagInputProps) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const atLimit = maxTags !== undefined && value.length >= maxTags

  const addTag = (raw: string) => {
    const tag = raw.trim()
    if (!tag || atLimit || value.includes(tag)) return
    onChange([...value, tag])
    setDraft('')
  }

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addTag(draft)
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      removeTag(value.length - 1)
    }
  }

  const query = draft.trim().toLowerCase()
  const visibleSuggestions = query
    ? suggestions.filter(
        (suggestion) =>
          suggestion.toLowerCase().includes(query) &&
          !value.includes(suggestion),
      )
    : []

  return (
    <div className="relative">
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 transition',
          'focus-within:border-[var(--cx-brand)]',
          disabled && 'cursor-not-allowed opacity-60',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, index) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cx-surface-3)] px-3 py-1.5 text-xs text-[var(--cx-text-1)]"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation()
                removeTag(index)
              }}
              className={cn(
                'flex size-4 items-center justify-center rounded-full text-[var(--cx-text-3)] transition',
                'hover:bg-[var(--cx-border-2)] hover:text-[var(--cx-text-1)]',
                'focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)] focus-visible:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Add tag"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--cx-text-4)]"
        />
      </div>
      {visibleSuggestions.length > 0 && (
        <ul className="absolute top-full right-0 left-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-1 shadow-[var(--cx-shadow-elevated)]">
          {visibleSuggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => {
                  addTag(suggestion)
                  inputRef.current?.focus()
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
