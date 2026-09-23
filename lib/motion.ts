export const MOTION_DURATION = {
  micro: 120,
  fast: 140,
  standard: 220,
  enter: 260,
  exit: 220,
  dialog: 260,
  sheet: 260,
  slow: 320,
  spring: 560,
} as const

export const MOTION_EASING = {
  standard: 'var(--cx-ease-standard)',
  enter: 'var(--cx-ease-enter)',
  exit: 'var(--cx-ease-exit)',
} as const

export const MOTION_CLASS = {
  interactive:
    'transition-[background-color,border-color,color,opacity,transform,box-shadow] duration-[var(--cx-duration-base)] ease-[var(--cx-ease-standard)]',
  fast: 'transition-[background-color,border-color,color,opacity,transform] duration-[var(--cx-duration-fast)] ease-[var(--cx-ease-standard)]',
  enter:
    'transition-[opacity,transform] duration-[var(--cx-duration-base)] ease-[var(--cx-ease-enter)]',
  exit: 'transition-[opacity,transform] duration-[var(--cx-duration-base)] ease-[var(--cx-ease-exit)]',
} as const

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
