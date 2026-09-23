import { Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'

type LogoProps = {
  size?: number
  wordmark?: boolean | string
  className?: string
}

export function Logo({ size = 36, wordmark = false, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-xl bg-[var(--cx-brand)] text-white shadow-[0_8px_24px_rgba(208,164,91,.28)]"
      >
        <Sparkles
          style={{
            width: Math.round(size * 0.44),
            height: Math.round(size * 0.44),
          }}
        />
      </span>
      {wordmark ? (
        <span className="font-display text-base font-semibold tracking-[-.02em]">
          {typeof wordmark === 'string' ? wordmark : 'Connect'}
        </span>
      ) : null}
    </span>
  )
}
