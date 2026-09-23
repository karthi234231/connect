import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

type ContainerProps = {
  as?: 'div' | 'main' | 'section' | 'header' | 'footer' | 'nav'
  variant?: 'default' | 'wide' | 'narrow'
  className?: string
  children: ReactNode
}

export function Container({
  as = 'div',
  variant = 'default',
  className,
  children,
}: ContainerProps) {
  const Tag = as
  return (
    <Tag
      className={cn(
        'mx-auto w-full max-w-[1180px] px-2.5 sm:px-6 lg:px-8',
        variant === 'wide' && 'max-w-[1400px]',
        variant === 'narrow' && 'max-w-[760px]',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
