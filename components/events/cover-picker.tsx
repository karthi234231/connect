'use client'

import { useState } from 'react'
import { Calendar, Check, Dices, Image as ImageIcon, Link2, Sparkles, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/utils/cn'

export interface CoverPreset {
  id: string
  name: string
  type: 'gradient' | 'image'
  value: string // CSS classes for gradient, or image URL for photo
}

export const PRESET_GRADIENTS: CoverPreset[] = [
  {
    id: 'sunset-spark',
    name: 'Sunset Glow',
    type: 'gradient',
    value: 'from-rose-500 via-amber-500 to-yellow-400',
  },
  {
    id: 'midnight-velvet',
    name: 'Midnight Velvet',
    type: 'gradient',
    value: 'from-indigo-600 via-purple-600 to-pink-500',
  },
  {
    id: 'aurora-teal',
    name: 'Aurora Teal',
    type: 'gradient',
    value: 'from-cyan-500 via-teal-500 to-emerald-500',
  },
  {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    type: 'gradient',
    value: 'from-fuchsia-600 via-violet-600 to-cyan-500',
  },
  {
    id: 'deep-space',
    name: 'Deep Space',
    type: 'gradient',
    value: 'from-slate-900 via-indigo-950 to-blue-900',
  },
  {
    id: 'warm-flare',
    name: 'Warm Flare',
    type: 'gradient',
    value: 'from-orange-500 via-red-500 to-rose-600',
  },
  {
    id: 'emerald-pulse',
    name: 'Emerald Pulse',
    type: 'gradient',
    value: 'from-emerald-600 via-teal-600 to-cyan-600',
  },
  {
    id: 'cosmic-purple',
    name: 'Cosmic Dusk',
    type: 'gradient',
    value: 'from-purple-800 via-violet-700 to-indigo-900',
  },
]

export const PRESET_PHOTOS: CoverPreset[] = [
  {
    id: 'photo-tech-conference',
    name: 'Tech Meetup',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'photo-coworking',
    name: 'Build Night',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'photo-party',
    name: 'Social Party',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'photo-coffee',
    name: 'Coffee & Chat',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'photo-workshop',
    name: 'Workshop',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'photo-live-stage',
    name: 'Live Stage',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
  },
]

export interface CoverPickerProps {
  value: string
  onChange: (value: string) => void
  previewTitle?: string
  disabled?: boolean
}

export function CoverPicker({
  value,
  onChange,
  previewTitle = 'Your Event Title',
  disabled = false,
}: CoverPickerProps) {
  const [activeTab, setActiveTab] = useState<'gradients' | 'photos' | 'custom'>('gradients')
  const [customUrl, setCustomUrl] = useState('')

  const isImageUrl = (val: string) =>
    val.startsWith('http://') ||
    val.startsWith('https://') ||
    val.startsWith('/') ||
    val.startsWith('data:')

  const currentIsImage = isImageUrl(value)

  const handleCustomApply = () => {
    if (customUrl.trim()) {
      onChange(customUrl.trim())
    }
  }

  const handleRandomize = () => {
    const allPresets = [...PRESET_GRADIENTS, ...PRESET_PHOTOS]
    const randomIndex = Math.floor(Math.random() * allPresets.length)
    onChange(allPresets[randomIndex].value)
  }

  return (
    <div className="space-y-4">
      {/* Visual Live Cover Header Preview */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--cx-border-1)] shadow-sm">
        <div
          className={cn(
            'relative flex h-36 w-full flex-col justify-between p-4 transition-all duration-300',
            !currentIsImage && (value ? `bg-gradient-to-r ${value}` : 'from-[var(--cx-brand-soft)] to-[var(--cx-surface-2)] bg-gradient-to-br'),
          )}
          style={
            currentIsImage
              ? {
                  backgroundImage: `url(${value})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          {/* Overlay gradient to ensure text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/30" />

          {/* Header Badges */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2.5 py-1 text-xs font-bold text-[#322b3a] shadow-sm backdrop-blur-md">
              <Calendar className="size-3.5 text-[#322b3a]" />
              COVER PREVIEW
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRandomize}
                disabled={disabled}
                title="Randomize Cover"
                className="inline-flex items-center gap-1 rounded-lg bg-black/40 px-2.5 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-md transition hover:bg-black/60"
              >
                <Dices className="size-3.5" />
                Randomize
              </button>
            </div>
          </div>

          {/* Header Title & Tag */}
          <div className="relative z-10">
            <span className="inline-block rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
              LUMA STYLE COVER
            </span>
            <h3 className="mt-1 font-display text-lg font-bold text-white drop-shadow-sm line-clamp-1">
              {previewTitle || 'Your Event Title'}
            </h3>
          </div>
        </div>
      </div>

      {/* Picker Tab Controls */}
      <div className="flex items-center justify-between border-b border-[var(--cx-border-1)] pb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('gradients')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
              activeTab === 'gradients'
                ? 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] font-semibold'
                : 'text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)]',
            )}
          >
            <Sparkles className="size-3.5" /> Preset Gradients
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
              activeTab === 'photos'
                ? 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] font-semibold'
                : 'text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)]',
            )}
          >
            <ImageIcon className="size-3.5" /> Curated Photos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
              activeTab === 'custom'
                ? 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] font-semibold'
                : 'text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)]',
            )}
          >
            <Link2 className="size-3.5" /> Custom URL
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'gradients' && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {PRESET_GRADIENTS.map((preset) => {
            const isSelected = value === preset.value
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange(preset.value)}
                disabled={disabled}
                className={cn(
                  'group relative flex h-20 flex-col justify-end overflow-hidden rounded-xl border p-2 text-left transition hover:scale-[1.02]',
                  isSelected
                    ? 'border-[var(--cx-brand)] ring-2 ring-[var(--cx-brand)]/30'
                    : 'border-[var(--cx-border-1)] hover:border-[var(--cx-border-2)]',
                )}
              >
                <div className={cn('absolute inset-0 bg-gradient-to-r', preset.value)} />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition" />
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-white text-[var(--cx-brand-strong)] shadow-md">
                    <Check className="size-3 stroke-[3]" />
                  </div>
                )}
                <span className="relative z-10 text-[11px] font-semibold text-white drop-shadow">
                  {preset.name}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {activeTab === 'photos' && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {PRESET_PHOTOS.map((preset) => {
            const isSelected = value === preset.value
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange(preset.value)}
                disabled={disabled}
                className={cn(
                  'group relative flex h-20 flex-col justify-end overflow-hidden rounded-xl border p-2 text-left transition hover:scale-[1.02]',
                  isSelected
                    ? 'border-[var(--cx-brand)] ring-2 ring-[var(--cx-brand)]/30'
                    : 'border-[var(--cx-border-1)] hover:border-[var(--cx-border-2)]',
                )}
              >
                <img
                  src={preset.value}
                  alt={preset.name}
                  className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition" />
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-white text-[var(--cx-brand-strong)] shadow-md">
                    <Check className="size-3 stroke-[3]" />
                  </div>
                )}
                <span className="relative z-10 text-[11px] font-semibold text-white drop-shadow">
                  {preset.name}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {activeTab === 'custom' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://images.unsplash.com/photo-..."
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              disabled={disabled}
              className="flex-1 text-xs"
            />
            <button
              type="button"
              onClick={handleCustomApply}
              disabled={disabled || !customUrl.trim()}
              className="rounded-xl bg-[var(--cx-brand)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--cx-brand-strong)] disabled:opacity-50"
            >
              Set Cover
            </button>
          </div>
          {currentIsImage && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-2.5 text-xs">
              <span className="truncate max-w-[300px] text-[var(--cx-text-2)]">{value}</span>
              <button
                type="button"
                onClick={() => onChange(PRESET_GRADIENTS[0].value)}
                className="flex items-center gap-1 text-[var(--cx-danger)] hover:underline"
              >
                <X className="size-3.5" /> Remove Image
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
