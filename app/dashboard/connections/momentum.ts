// app/dashboard/connections/momentum.ts
// Pure presentation mapping for connection momentum. Turns the relationship
// state machine's state into a stable label + treatment for the connections
// grid. Client-safe and unit-testable — no server imports.

export type MomentumKind = 'active' | 'awaiting' | 'follow-up' | 'hello'

export interface MomentumPresentation {
  kind: MomentumKind
  label: string
}

const MOMENTUM_LABELS: Record<string, MomentumPresentation> = {
  conversation_active: { kind: 'active', label: 'Active' },
  awaiting_reply: { kind: 'awaiting', label: 'Awaiting reply' },
  next_action_eligible: { kind: 'follow-up', label: 'Follow up' },
  matched_no_messages: { kind: 'hello', label: 'Say hello' },
}

/**
 * Presentational label for a relationship state. Unknown states return null so
 * the UI can stay silent rather than mislabel — stricter states may be added
 * server-side before this mapping catches up.
 */
export function momentumPresentation(
  state: string | null | undefined,
): MomentumPresentation | null {
  if (!state) return null
  return MOMENTUM_LABELS[state] ?? null
}
