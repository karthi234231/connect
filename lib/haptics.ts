export type HapticPattern =
  | 'tick'
  | 'confirm'
  | 'celebrate'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error'

export const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  tick: 10,
  confirm: [12, 40, 12],
  celebrate: [15, 50, 15, 50, 30],
  selection: 8,
  success: [8, 20, 12],
  warning: [12, 24, 12],
  error: [18, 30, 18],
}

const HAPTICS_KEY = 'cx-haptics-enabled'

export function hapticsEnabled(): boolean {
  if (typeof localStorage === 'undefined') {
    return true
  }

  try {
    const raw = localStorage.getItem(HAPTICS_KEY)
    return raw === null ? true : raw !== '0'
  } catch {
    return true
  }
}

export function setHapticsEnabled(on: boolean): void {
  try {
    localStorage.setItem(HAPTICS_KEY, on ? '1' : '0')
  } catch {
    // Haptics preference is best-effort; storage may be unavailable.
  }
}

function motionOK(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return true
  }

  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

function canVibrate() {
  return (
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  )
}

export function triggerHaptic(pattern: HapticPattern = 'tick'): boolean {
  if (!hapticsEnabled() || !motionOK() || !canVibrate()) {
    return false
  }

  try {
    return navigator.vibrate(HAPTIC_PATTERNS[pattern])
  } catch {
    return false
  }
}

export function stopHaptic() {
  if (!canVibrate()) {
    return
  }

  try {
    navigator.vibrate(0)
  } catch {
    // Haptics are optional and unsupported platforms
    // should fail silently.
  }
}
