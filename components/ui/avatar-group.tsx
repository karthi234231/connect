import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui'
import { cn } from '@/utils/cn'

export interface AvatarGroupItem {
  src?: string
  alt: string
  initials: string
  tone?: string
}

export interface AvatarGroupProps {
  items: AvatarGroupItem[]
  max?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const avatarSizes = {
  sm: 'size-7 text-[10px]',
  md: 'size-9 text-xs',
  lg: 'size-11 text-sm',
} as const

export function AvatarGroup({
  items,
  max = 4,
  size = 'md',
  className,
}: AvatarGroupProps) {
  const visible = items.slice(0, max)
  const overflow = items.length - visible.length

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {visible.map((item) => (
        <Avatar
          key={item.alt}
          avatarClassName={cn(avatarSizes[size], item.tone)}
          title={item.alt}
        >
          {item.src ? <AvatarImage src={item.src} alt={item.alt} /> : null}
          <AvatarFallback>{item.initials}</AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 ? (
        <div
          title={`${overflow} more`}
          aria-hidden="true"
          className={cn(
            'flex items-center justify-center rounded-full bg-[var(--cx-surface-3)] font-semibold text-[var(--cx-text-2)] ring-2 ring-[var(--cx-surface-1)]',
            avatarSizes[size],
          )}
        >
          +{overflow}
        </div>
      ) : null}
    </div>
  )
}
