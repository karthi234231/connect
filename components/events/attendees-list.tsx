import { AvatarGroup } from '@/components/ui/avatar-group'

export interface AttendeeItem {
  src?: string
  alt: string
  initials: string
  tone?: string
}

export interface AttendeesListProps {
  attendees: AttendeeItem[]
  capacity?: number
  limitLabel?: string
}

export function AttendeesList({
  attendees,
  capacity,
  limitLabel,
}: AttendeesListProps) {
  const total = attendees.length
  const label =
    capacity !== undefined
      ? `${total} going · ${capacity - total} spots left`
      : (limitLabel ?? `${total} going`)

  return (
    <div className="flex items-center gap-2">
      <AvatarGroup items={attendees} />
      <span className="text-xs text-[var(--cx-text-3)]">{label}</span>
    </div>
  )
}
