import type { Breakpoint } from '@/config/breakpoints'
import { BREAKPOINTS } from '@/config/breakpoints'
import { useMediaQuery } from '@/hooks/use-media-query'

export function useIsMobile(breakpoint: Breakpoint = 'md'): boolean {
  const maxWidth = BREAKPOINTS[breakpoint] - 1
  return useMediaQuery(`(max-width: ${maxWidth}px)`)
}
