'use client'

import { useState } from 'react'
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Share2,
} from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { showSuccessToast } from '@/lib/toast'
import { cn } from '@/utils/cn'
import type { EventItem } from './event'

export interface ShareEventDialogProps {
  event: EventItem
  open: boolean
  onOpenChange: (open: boolean) => void
  shareUrl?: string
}

export function ShareEventDialog({
  event,
  open,
  onOpenChange,
  shareUrl,
}: ShareEventDialogProps) {
  const [copied, setCopied] = useState(false)

  const defaultUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/events/${event.id}`
      : `https://connect.app/events/${event.id}`

  const targetUrl = shareUrl || defaultUrl
  const shareText = `Join me at "${event.title}"! ${event.month} ${event.date} · ${event.location}`

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(targetUrl)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = targetUrl
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      showSuccessToast('Event link copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      showSuccessToast('Copied event link!')
    }
  }

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: shareText,
          url: targetUrl,
        })
      } catch {
        // User cancelled native share sheet
      }
    }
  }

  const isImageUrl = (val?: string) =>
    val &&
    (val.startsWith('http://') ||
      val.startsWith('https://') ||
      val.startsWith('/') ||
      val.startsWith('data:'))

  const isCoverImage = isImageUrl(event.coverImage)

  const socialChannels = [
    {
      name: 'Twitter / X',
      icon: (
        <svg className="size-4 fill-current" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      bg: 'bg-black text-white hover:bg-neutral-800',
      shareUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        shareText,
      )}&url=${encodeURIComponent(targetUrl)}`,
    },
    {
      name: 'LinkedIn',
      icon: (
        <svg className="size-4 fill-current" viewBox="0 0 24 24">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.72a1.47 1.47 0 0 0-1.48 1.47c0 .81.66 1.47 1.48 1.47s1.48-.66 1.48-1.47c0-.81-.67-1.47-1.48-1.47Z" />
        </svg>
      ),
      bg: 'bg-[#0077b5] text-white hover:bg-[#006396]',
      shareUrl: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        targetUrl,
      )}`,
    },
    {
      name: 'WhatsApp',
      icon: <MessageCircle className="size-4" />,
      bg: 'bg-[#25D366] text-white hover:bg-[#20bd5a]',
      shareUrl: `https://api.whatsapp.com/send?text=${encodeURIComponent(
        `${shareText} ${targetUrl}`,
      )}`,
    },
    {
      name: 'Facebook',
      icon: (
        <svg className="size-4 fill-current" viewBox="0 0 24 24">
          <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H7.5v-3H10V9.69c0-2.47 1.47-3.83 3.72-3.83 1.08 0 2.2.19 2.2.19v2.42h-1.24c-1.23 0-1.61.76-1.61 1.54V12h2.72l-.43 3H13v6.8c4.56-.93 8-4.96 8-9.8z" />
        </svg>
      ),
      bg: 'bg-[#1877F2] text-white hover:bg-[#166fe5]',
      shareUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        targetUrl,
      )}`,
    },
    {
      name: 'Email',
      icon: <Mail className="size-4" />,
      bg: 'bg-[var(--cx-surface-3)] text-[var(--cx-text-1)] border border-[var(--cx-border-1)] hover:bg-[var(--cx-border-1)]',
      shareUrl: `mailto:?subject=${encodeURIComponent(
        event.title,
      )}&body=${encodeURIComponent(`${shareText}\n\n${targetUrl}`)}`,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0 rounded-2xl">
        {/* Banner Preview */}
        <div
          className={cn(
            'relative flex h-32 w-full flex-col justify-between p-4',
            !isCoverImage &&
              (event.tone ??
                'from-[var(--cx-brand-soft)] to-[var(--cx-surface-2)] bg-gradient-to-br'),
          )}
          style={
            isCoverImage
              ? {
                  backgroundImage: `url(${event.coverImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
          <div className="relative z-10 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2.5 py-1 text-xs font-bold text-[#322b3a] shadow-sm backdrop-blur-md">
              <Calendar className="size-3.5" />
              {event.month} {event.date}
            </span>
            <DialogClose className="rounded-full bg-black/40 p-1 text-white hover:bg-black/60 backdrop-blur-md transition" />
          </div>

          <div className="relative z-10">
            <h3 className="font-display text-lg font-bold text-white drop-shadow line-clamp-1">
              {event.title}
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-white/90">
              <MapPin className="size-3" />
              <span className="truncate">{event.location}</span>
            </p>
          </div>
        </div>

        {/* Dialog Body */}
        <div className="p-5 space-y-5">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold text-[var(--cx-text-1)] flex items-center gap-2">
              <Share2 className="size-5 text-[var(--cx-brand)]" />
              Share Gathering
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--cx-text-3)]">
              Invite friends, colleagues, and community members to join this event.
            </DialogDescription>
          </DialogHeader>

          {/* Social Share Grid */}
          <div className="space-y-2">
            <label className="block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
              Share via
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {socialChannels.map((channel) => (
                <a
                  key={channel.name}
                  href={channel.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-medium transition shadow-sm',
                    channel.bg,
                  )}
                >
                  {channel.icon}
                  <span>{channel.name}</span>
                </a>
              ))}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] py-2.5 px-3 text-xs font-medium text-[var(--cx-text-1)] hover:border-[var(--cx-border-2)] transition"
                >
                  <Share2 className="size-4" />
                  <span>More…</span>
                </button>
              )}
            </div>
          </div>

          {/* Copy Link Input Section */}
          <div className="space-y-2">
            <label className="block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
              Event Link
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-1.5 focus-within:border-[var(--cx-brand)]">
              <div className="flex items-center gap-2 px-2 text-[var(--cx-text-3)] flex-1 min-w-0">
                <Globe className="size-4 shrink-0 text-[var(--cx-brand)]" />
                <span className="truncate text-xs text-[var(--cx-text-1)] font-mono">
                  {targetUrl}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition shrink-0',
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[var(--cx-brand)] text-white hover:bg-[var(--cx-brand-strong)] shadow-sm',
                )}
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 stroke-[3]" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" /> Copy Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
