'use client'

import { useState, type KeyboardEvent } from 'react'
import { Check, X } from 'lucide-react'
import { Input } from '@/components/ui'
import { cn } from '@/utils/cn'

export interface InterestsEditorProps {
  interests: string[]
  onInterestsChange?: (interests: string[]) => void
  editable?: boolean
  suggestions?: string[]
  onManage?: () => void
  /** Hide the inline add-input row — for pairing with a dedicated TagInput. */
  showInput?: boolean
}

export function InterestsEditor({
  interests,
  onInterestsChange,
  editable = false,
  suggestions = [],
  onManage,
  showInput = true,
}: InterestsEditorProps) {
  const [draft, setDraft] = useState('')

  const addInterest = (interest: string) => {
    const value = interest.trim()
    if (!value || interests.includes(value)) return
    onInterestsChange?.([...interests, value])
  }

  const removeInterest = (interest: string) => {
    onInterestsChange?.(interests.filter((item) => item !== interest))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    addInterest(draft)
    setDraft('')
  }

  const availableSuggestions = suggestions.filter(
    (item) => !interests.includes(item),
  )
  const shownSuggestions = editable ? availableSuggestions.slice(0, 3) : []
  const hasMore = availableSuggestions.length > shownSuggestions.length

  const manageButton = onManage ? (
    <button
      type="button"
      onClick={onManage}
      className="self-start text-xs font-medium text-[var(--cx-brand-strong)] hover:underline"
    >
      Manage interests
    </button>
  ) : null

  return (
    <div className="flex flex-col gap-3">
      {interests.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {interests.map((interest) => (
            <span
              key={interest}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2 text-xs text-[var(--cx-text-2)]',
                editable && 'pr-2',
              )}
            >
              {interest}
              {editable ? (
                <button
                  type="button"
                  onClick={() => removeInterest(interest)}
                  aria-label={`Remove ${interest}`}
                  className="flex size-4 items-center justify-center rounded-full text-[var(--cx-text-4)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--cx-text-4)]">
          No interests added yet.
        </p>
      )}

      {editable && showInput ? (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add an interest…"
            aria-label="Add an interest"
          />
          <button
            type="button"
            onClick={() => {
              addInterest(draft)
              setDraft('')
            }}
            aria-label="Add interest"
            className="flex size-[42px] shrink-0 items-center justify-center rounded-2xl bg-[var(--cx-brand)] text-white transition hover:bg-[var(--cx-brand-strong)]"
          >
            <Check className="size-4" />
          </button>
        </div>
      ) : null}

      {shownSuggestions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
            Suggested
          </p>
          <div className="flex flex-wrap gap-2">
            {shownSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addInterest(suggestion)}
                className="rounded-xl border border-dashed border-[var(--cx-border-2)] px-3 py-2 text-xs text-[var(--cx-brand-strong)] transition hover:bg-[var(--cx-brand-soft)]"
              >
                + {suggestion}
              </button>
            ))}
          </div>
          {hasMore ? (
            <p className="text-[10px] text-[var(--cx-text-4)]">
              Add up to 3 more interests to help people find you.
            </p>
          ) : null}
        </div>
      ) : null}

      {manageButton}
    </div>
  )
}
