// lib/chat/typing-controller.ts
// Pure typing-presence expiry state machine. The hook keeps a controller per
// conversation and feeds it inbound S032 `typing` envelopes; the controller
// decides what the UI should show, expiring stale presence after `timeoutMs`
// with no refresh. Pure & DOM-free so it is unit-testable in isolation.

export const DEFAULT_TYPING_TIMEOUT_MS = 4000

export interface TypingControllerOptions {
  /** Presence stays visible `timeoutMs` after the last `true` signal. */
  timeoutMs?: number
}

export interface TypingController {
  /**
   * Apply a typing signal (`true` = peer is typing, `false` = stopped) at
   * wall-clock `now`. Returns the post-update visibility.
   */
  update(isTyping: boolean, now: number): boolean
  /**
   * Advance the clock: hides presence once it has been stale for at least
   * `timeoutMs`. Returns the post-tick visibility. Safe to call on every
   * engine status tick / timer fire.
   */
  tick(now: number): boolean
  /**
   * Drop all presence state — used on inbound `message` events and on
   * `matchId` change (typing is per-conversation). Always returns false.
   */
  reset(): boolean
  /** Current visibility without mutating state. */
  isVisible(): boolean
}

export function createTypingController(
  options: TypingControllerOptions = {},
): TypingController {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TYPING_TIMEOUT_MS
  let visible = false
  let lastActivityAt: number | null = null

  return {
    update(isTyping, now) {
      if (isTyping) {
        visible = true
        lastActivityAt = now
      } else {
        visible = false
        lastActivityAt = null
      }
      return visible
    },

    tick(now) {
      if (
        visible &&
        lastActivityAt !== null &&
        now - lastActivityAt >= timeoutMs
      ) {
        visible = false
        lastActivityAt = null
      }
      return visible
    },

    reset() {
      visible = false
      lastActivityAt = null
      return false
    },

    isVisible() {
      return visible
    },
  }
}