import { Pencil, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage, Button } from '@/components/ui'
import type { SocialLinks } from '@/types/profile'
import { SocialLinksBar } from './social-links-bar'
import { cn } from '@/utils/cn'

export interface ProfileHeaderProps {
  name: string
  headline: string
  location?: string
  bio?: string
  avatarUrl?: string
  initials?: string
  tone?: string
  availability?: string
  availabilityTone?: 'success' | 'info'
  skills?: string[]
  stats?: { label: string; value: string }[]
  socialLinks?: SocialLinks | null
  actions?: React.ReactNode
  onEdit?: () => void
  editing?: boolean
}

export function ProfileHeader({
  name,
  headline,
  location,
  bio,
  avatarUrl,
  initials,
  tone = 'bg-[#e4c1aa]',
  availability,
  availabilityTone = 'success',
  skills = [],
  stats = [],
  socialLinks,
  actions,
  onEdit,
  editing = false,
}: ProfileHeaderProps) {
  const avatarInitials = initials ?? name.trim().charAt(0).toUpperCase()
  const toneText = tone === 'bg-[#e4c1aa]' ? 'text-[#3b2822]' : 'text-[#332d3d]'

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] shadow">
      <div
        className="h-24 bg-gradient-to-br from-[#8374c3] via-[#b8a9db] to-[#e8c0aa]"
        aria-hidden="true"
      />
      <div className="px-5 pb-5">
        {avatarUrl ? (
          <Avatar
            className={cn(
              '-mt-10 size-20 border-4 border-[var(--cx-surface-1)] shadow',
              tone,
              toneText,
            )}
          >
            <AvatarImage
              src={avatarUrl}
              alt={name}
              className="rounded-[24px]"
            />
            <AvatarFallback>{avatarInitials}</AvatarFallback>
          </Avatar>
        ) : (
          <div
            className={cn(
              '-mt-10 flex size-20 items-center justify-center rounded-[24px] border-4 border-[var(--cx-surface-1)] text-2xl font-semibold shadow',
              tone,
              toneText,
            )}
          >
            {avatarInitials}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-[24px] font-semibold tracking-[-.04em] text-[var(--cx-text-1)]">
              {name}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--cx-text-3)]">{headline}</p>
            {location ? (
              <p className="mt-0.5 text-xs text-[var(--cx-text-4)]">
                {location}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {onEdit ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={editing ? 'Stop editing' : 'Edit profile'}
                onClick={onEdit}
              >
                {editing ? (
                  <X className="size-4" />
                ) : (
                  <Pencil className="size-4" />
                )}
              </Button>
            ) : null}
          </div>
        </div>

        {availability ? (
          <span
            className={cn(
              'mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium',
              availabilityTone === 'success'
                ? 'bg-[var(--cx-success-soft)] text-[var(--cx-success)]'
                : 'bg-[var(--cx-info-soft)] text-[var(--cx-info)]',
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                availabilityTone === 'success'
                  ? 'bg-[var(--cx-success)]'
                  : 'bg-[var(--cx-info)]',
              )}
              aria-hidden="true"
            />
            {availability}
          </span>
        ) : null}

        {bio ? (
          <p className="mt-3 text-sm leading-5 text-[var(--cx-text-2)]">
            {bio}
          </p>
        ) : null}

        {socialLinks ? (
          <div className="mt-4 pt-3 border-t border-[var(--cx-border-1)]">
            <SocialLinksBar socialLinks={socialLinks} size="sm" showLabels />
          </div>
        ) : null}

        {skills.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <li
                key={skill}
                className="rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2.5 py-1 text-[11px] text-[var(--cx-text-2)]"
              >
                {skill}
              </li>
            ))}
          </ul>
        ) : null}

        {stats.length > 0 ? (
          <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-[var(--cx-border-1)] pt-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-sm font-semibold text-[var(--cx-text-1)]">
                  {stat.value}
                </dd>
                <p className="mt-0.5 text-xs text-[var(--cx-text-4)]">
                  {stat.label}
                </p>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  )
}
