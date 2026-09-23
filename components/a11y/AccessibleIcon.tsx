import type { ReactNode } from 'react'

type AccessibleIconProps = {
  children: ReactNode
  label?: string
  className?: string
}

export function AccessibleIcon({
  children,
  label,
  className,
}: AccessibleIconProps) {
  if (label) {
    return (
      <span role="img" aria-label={label} className={className}>
        {children}
      </span>
    )
  }
  return (
    <span aria-hidden="true" className={className}>
      {children}
    </span>
  )
}
