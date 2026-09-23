import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

type HeaderProps = {
  left?: ReactNode
  center?: ReactNode
  right?: ReactNode
  className?: string
}

export function Header({ left, center, right, className }: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 border-b border-[var(--cx-border-1)] bg-[color:var(--cx-bg)/.94] backdrop-blur-xl',
        className,
      )}
    >
      <div className="mx-auto flex h-[50px] max-w-[1180px] items-center justify-between gap-2 px-2.5 sm:h-[68px] sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center">{left}</div>
        {center ? (
          <div className="flex min-w-0 flex-1 items-center justify-center px-2">
            {center}
          </div>
        ) : null}
        {right ? (
          <div className="flex shrink-0 items-center">{right}</div>
        ) : null}
      </div>
    </header>
  )
}
