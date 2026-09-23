import { describe, expect, it } from 'vitest'

import { momentumPresentation } from './momentum'

describe('momentumPresentation', () => {
  it('maps every known relationship state to a label', () => {
    expect(momentumPresentation('conversation_active')).toEqual({
      kind: 'active',
      label: 'Active',
    })
    expect(momentumPresentation('awaiting_reply')).toEqual({
      kind: 'awaiting',
      label: 'Awaiting reply',
    })
    expect(momentumPresentation('next_action_eligible')).toEqual({
      kind: 'follow-up',
      label: 'Follow up',
    })
    expect(momentumPresentation('matched_no_messages')).toEqual({
      kind: 'hello',
      label: 'Say hello',
    })
  })

  it('stays silent for unknown or empty states', () => {
    expect(momentumPresentation('some_future_state')).toBeNull()
    expect(momentumPresentation('')).toBeNull()
    expect(momentumPresentation(null)).toBeNull()
    expect(momentumPresentation(undefined)).toBeNull()
  })
})
