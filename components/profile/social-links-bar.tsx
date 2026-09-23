'use client'

import { Globe, ExternalLink } from 'lucide-react'
import type { SocialLinks } from '@/types/profile'
import { formatSocialUrl } from '@/utils/vcard'
import { cn } from '@/utils/cn'

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.74a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z" />
    </svg>
  )
}

function TwitterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export interface SocialLinksBarProps {
  socialLinks?: SocialLinks | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
}

export function SocialLinksBar({
  socialLinks,
  className,
  size = 'md',
  showLabels = false,
}: SocialLinksBarProps) {
  if (!socialLinks) return null

  const items = [
    {
      key: 'github',
      label: 'GitHub',
      value: socialLinks.github,
      url: socialLinks.github ? formatSocialUrl('github', socialLinks.github) : null,
      icon: GithubIcon,
      color: 'hover:text-[#2da44e] hover:border-[#2da44e]/30 hover:bg-[#2da44e]/5',
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      value: socialLinks.linkedin,
      url: socialLinks.linkedin ? formatSocialUrl('linkedin', socialLinks.linkedin) : null,
      icon: LinkedinIcon,
      color: 'hover:text-[#0a66c2] hover:border-[#0a66c2]/30 hover:bg-[#0a66c2]/5',
    },
    {
      key: 'twitter',
      label: 'X / Twitter',
      value: socialLinks.twitter,
      url: socialLinks.twitter ? formatSocialUrl('twitter', socialLinks.twitter) : null,
      icon: TwitterIcon,
      color: 'hover:text-[#1d9bf0] hover:border-[#1d9bf0]/30 hover:bg-[#1d9bf0]/5',
    },
    {
      key: 'portfolio',
      label: 'Portfolio',
      value: socialLinks.portfolio,
      url: socialLinks.portfolio ? formatSocialUrl('portfolio', socialLinks.portfolio) : null,
      icon: Globe,
      color: 'hover:text-[var(--cx-brand-strong)] hover:border-[var(--cx-brand)]/30 hover:bg-[var(--cx-brand-soft)]',
    },
  ].filter((item) => Boolean(item.url && item.value?.trim()))

  if (items.length === 0) return null

  const iconSizes = {
    sm: 'size-3.5',
    md: 'size-4',
    lg: 'size-5',
  }

  const containerPadding = {
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-xs',
    lg: 'p-2.5 text-sm',
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <a
            key={item.key}
            href={item.url!}
            target="_blank"
            rel="noopener noreferrer"
            title={`${item.label}: ${item.value}`}
            aria-label={`${item.label} link: ${item.value}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] font-medium text-[var(--cx-text-2)] transition-all duration-200',
              containerPadding[size],
              item.color,
            )}
          >
            <Icon className={cn(iconSizes[size], 'shrink-0')} />
            {showLabels ? <span>{item.label}</span> : null}
            <ExternalLink className="size-3 opacity-50 shrink-0" />
          </a>
        )
      })}
    </div>
  )
}
