'use client'

import { MapPin, Briefcase, Target, Clock, Sparkles } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui'
import { MatchScoreBadge } from '@/components/matching/match-score-badge'
import { SkillOverlapBadge } from '@/components/matching/skill-overlap-badge'
import { getIntentLabel } from '@/services/profiles/intent'
import { cn } from '@/utils/cn'

export interface ProfileCardProps {
  name: string
  role?: string | null
  bio?: string | null
  location?: string | null
  avatarUrl?: string | null
  initials?: string
  tone?: string
  availability?: string | null
  skillsOffered?: string[]
  skillsSought?: string[]
  lookingForRoles?: string[]
  offeringCategories?: string[]
  matchScore?: number
  matchFactors?: { label: string; value: number }[]
  skillOverlaps?: string[]
  onDetail?: () => void
  className?: string
}

export function ProfileCard({
  name,
  role,
  bio,
  location,
  avatarUrl,
  initials = '··',
  tone = 'bg-[#e4c1aa]',
  availability,
  skillsOffered = [],
  skillsSought = [],
  lookingForRoles = [],
  offeringCategories = [],
  matchScore,
  matchFactors,
  skillOverlaps = [],
  onDetail,
  className,
}: ProfileCardProps) {
  const resolvedRole = role ? (getIntentLabel(role) ?? role) : ''
  const overlapsSet = new Set(skillOverlaps.map((s) => s.toLowerCase().trim()))

  // Intent badges resolved via getIntentLabel
  const offeringBadges = (offeringCategories.length > 0 ? offeringCategories : skillsOffered)
    .map((item) => getIntentLabel(item) ?? item)
    .filter((value, index, self) => self.indexOf(value) === index)

  const lookingBadges = (lookingForRoles.length > 0 ? lookingForRoles : skillsSought)
    .map((item) => getIntentLabel(item) ?? item)
    .filter((value, index, self) => self.indexOf(value) === index)

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 shadow-[var(--cx-shadow-card)] transition hover:border-[var(--cx-border-2)]',
        className,
      )}
    >
      {/* Background ambient subtle glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[color-mix(in_srgb,var(--cx-brand)_15%,transparent)] blur-2xl"
      />

      <div className="relative z-10 space-y-4">
        {/* Header Row: Avatar, Name, Role, Location, Match Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <Avatar avatarClassName="size-14 shrink-0 shadow-sm" className={tone}>
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={name} />
              ) : (
                <AvatarFallback className="text-base font-semibold text-[#332d3d]">
                  {initials}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0">
              <button
                type="button"
                onClick={onDetail}
                className="group block text-left focus:outline-none"
              >
                <h3 className="truncate font-display text-lg font-semibold text-[var(--cx-text-1)] group-hover:text-[var(--cx-brand-strong)] transition-colors">
                  {name}
                </h3>
              </button>
              {resolvedRole ? (
                <p className="truncate text-xs font-medium text-[var(--cx-brand-strong)] mt-0.5">
                  {resolvedRole}
                </p>
              ) : null}
              {location ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-[var(--cx-text-3)]">
                  <MapPin className="size-3 shrink-0 text-[var(--cx-text-4)]" />
                  <span className="truncate">{location}</span>
                </p>
              ) : null}
            </div>
          </div>

          {typeof matchScore === 'number' ? (
            <MatchScoreBadge score={matchScore} factors={matchFactors} size="sm" />
          ) : null}
        </div>

        {/* Availability Badge */}
        {availability ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--cx-success)] bg-[var(--cx-success-soft)] px-2.5 py-1 rounded-full w-fit">
            <Clock className="size-3.5" />
            <span>{availability}</span>
          </div>
        ) : null}

        {/* Bio Section */}
        {bio ? (
          <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)]/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-4)] mb-1">
              Bio
            </p>
            <p className="text-xs leading-5 text-[var(--cx-text-2)] line-clamp-3">
              {bio}
            </p>
          </div>
        ) : null}

        {/* Intent Badges Grid: Skills/Categories Offered & Skills/Roles Sought */}
        {(offeringBadges.length > 0 || lookingBadges.length > 0) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {offeringBadges.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                  <Briefcase className="size-3 text-[var(--cx-brand)]" />
                  <span>Offering</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {offeringBadges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2.5 py-0.5 text-[11px] text-[var(--cx-text-2)]"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {lookingBadges.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                  <Target className="size-3 text-[var(--cx-info)]" />
                  <span>Looking for</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {lookingBadges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full bg-[var(--cx-brand-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--cx-brand-strong)]"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Skills Offered Tag Cloud (with Skill Overlap Badges) */}
        {skillsOffered.length > 0 ? (
          <div className="pt-2 border-t border-[var(--cx-border-1)]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)] mb-1.5">
              Skills Offered
            </p>
            <div className="flex flex-wrap gap-1.5">
              {skillsOffered.map((skill) => (
                <SkillOverlapBadge
                  key={skill}
                  skill={skill}
                  isOverlap={overlapsSet.has(skill.toLowerCase().trim())}
                  size="sm"
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}
