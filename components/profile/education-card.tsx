export interface EducationCardProps {
  school: string
  degree: string
  period?: string
  issuer?: string
}

export function EducationCard({
  school,
  degree,
  period,
  issuer,
}: EducationCardProps) {
  const meta = [period, issuer].filter(Boolean).join(' · ')

  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3">
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--cx-brand-soft)] text-xs font-semibold text-[var(--cx-brand-strong)]"
        aria-hidden="true"
      >
        ED
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-[var(--cx-text-1)]">
          {school}
        </h4>
        <p className="mt-0.5 text-xs font-medium text-[var(--cx-text-2)]">
          {degree}
        </p>
        {meta ? (
          <p className="mt-0.5 text-[11px] text-[var(--cx-text-3)]">{meta}</p>
        ) : null}
      </div>
    </div>
  )
}
