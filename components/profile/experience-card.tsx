import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui'

export interface ExperienceCardProps {
  role: string
  org: string
  period?: string
  current?: boolean
  location?: string
  description?: string
  onEdit?: () => void
  editable?: boolean
  source?: string
}

export function ExperienceCard({
  role,
  org,
  period,
  current = false,
  location,
  description,
  onEdit,
  editable = false,
  source,
}: ExperienceCardProps) {
  const periodLabel = current
    ? period && !period.toLowerCase().includes('present')
      ? `${period} — Present`
      : (period ?? 'Present')
    : period

  return (
    <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--cx-text-1)]">
              {role}
            </h4>
            {current ? <Badge variant="brand">Current</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs font-medium text-[var(--cx-text-2)]">
            {org}
          </p>
        </div>
        {editable ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${role} experience`}
            className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--cx-text-3)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]"
          >
            <Pencil className="size-3.5" />
          </button>
        ) : null}
      </div>
      {periodLabel ? (
        <p className="mt-1 text-xs text-[var(--cx-text-3)]">{periodLabel}</p>
      ) : null}
      {location ? (
        <p className="mt-0.5 text-xs text-[var(--cx-text-4)]">{location}</p>
      ) : null}
      {description ? (
        <p className="mt-2 text-[11px] leading-4 text-[var(--cx-text-3)]">
          {description}
        </p>
      ) : null}
      {source ? (
        <div className="mt-2">
          <Badge variant="brand">{source}</Badge>
        </div>
      ) : null}
    </div>
  )
}
