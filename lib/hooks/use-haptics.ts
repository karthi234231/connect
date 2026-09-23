'use client'

import * as React from 'react'

import { stopHaptic, triggerHaptic, type HapticPattern } from '@/lib/haptics'

export function useHaptics() {
  const trigger = React.useCallback((pattern: HapticPattern = 'selection') => {
    return triggerHaptic(pattern)
  }, [])

  const stop = React.useCallback(() => {
    stopHaptic()
  }, [])

  return {
    trigger,
    stop,
    supported:
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function',
  }
}
