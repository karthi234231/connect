import { useEffect } from 'react'

export interface KeyboardShortcutOptions {
  enabled?: boolean
  preventDefault?: boolean
}

export function useKeyboardShortcut(
  keys: string[],
  handler: (event: KeyboardEvent) => void,
  options: KeyboardShortcutOptions = {},
): void {
  const { enabled = true, preventDefault = false } = options

  useEffect(() => {
    if (!enabled) return

    const normalized = keys.map((key) => key.toLowerCase())

    const onKeyDown = (event: KeyboardEvent) => {
      const pressed = event.key.toLowerCase()
      const matches = normalized.every((key) => {
        if (key === 'mod' || key === 'meta') return event.metaKey
        if (key === 'ctrl') return event.ctrlKey
        if (key === 'alt') return event.altKey
        if (key === 'shift') return event.shiftKey
        return pressed === key
      })

      if (!matches) return
      if (preventDefault) event.preventDefault()
      handler(event)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `keys` is deliberately tracked by its joined signature so callers passing an inline array literal don't re-bind the listener on every render.
  }, [keys.join(','), handler, enabled, preventDefault])
}
