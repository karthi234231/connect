'use client'

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import { Upload, X } from 'lucide-react'
import { cn } from '@/utils/cn'

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  return accept.split(',').some((pattern) => {
    const p = pattern.trim().toLowerCase()
    if (!p) return false
    if (p.startsWith('.')) return name.endsWith(p)
    if (p.endsWith('/*')) return type.startsWith(p.slice(0, -1))
    return type === p
  })
}

export interface DropZoneProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  accept?: string
  multiple?: boolean
  maxSizeMb?: number
  label?: string
  hint?: string
  disabled?: boolean
}

export function DropZone({
  files,
  onFilesChange,
  accept,
  multiple = true,
  maxSizeMb = 10,
  label,
  hint,
  disabled = false,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const openPicker = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const handleFiles = (incoming: File[]) => {
    if (disabled) return
    const maxBytes = maxSizeMb * 1024 * 1024
    const valid = incoming.filter(
      (file) => matchesAccept(file, accept) && file.size <= maxBytes,
    )
    if (valid.length === 0) return
    onFilesChange(multiple ? [...files, ...valid] : valid.slice(-1))
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragging(true)
  }

  const handleDragLeave = () => {
    setDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    setDragging(false)
    handleFiles(Array.from(event.dataTransfer.files))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openPicker()
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'rounded-2xl border-2 border-dashed border-[var(--cx-border-2)] p-4 transition',
        'cursor-pointer outline-none',
        'hover:border-[var(--cx-brand)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)]',
        dragging && 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)]',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleInputChange}
      />
      <div className="flex items-center gap-2 text-sm">
        <Upload className="size-4 text-[var(--cx-text-3)]" />
        <span className="text-[var(--cx-text-2)]">
          {label ?? 'Drop files here'}
        </span>
        {hint && (
          <span className="text-xs text-[var(--cx-text-4)]">{hint}</span>
        )}
      </div>
      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cx-surface-3)] px-3 py-1.5 text-xs text-[var(--cx-text-1)]"
            >
              <span className="max-w-40 truncate">{file.name}</span>
              <span className="text-[var(--cx-text-4)]">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  onFilesChange(files.filter((_, i) => i !== index))
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
