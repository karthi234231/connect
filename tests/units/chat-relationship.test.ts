import { describe, expect, it } from 'vitest'
import {
  buildReminder,
  buildSharedContext,
  buildStarterPrompts,
  formatRole,
  hasActionableContext,
  MAX_STARTERS,
  shareReasonLine,
  type StarterPrompt,
} from '@/lib/chat/relationship'
import { MOMENTUM_THRESHOLDS } from '@/lib/chat/momentum'

interface ProfileLike {
  role: string
  skills: string[]
  timezone: string
  fullName: string
}

function viewer(overrides: Partial<ProfileLike> = {}): ProfileLike {
  return {
    fullName: 'Grace Hopper',
    role: 'engineer',
    skills: ['TypeScript', 'React'],
    timezone: 'UTC',
    ...overrides,
  } as ProfileLike
}

function other(overrides: Partial<ProfileLike> = {}): ProfileLike {
  return {
    fullName: 'Ada Lovelace',
    role: 'engineer',
    skills: ['TypeScript', 'GraphQL'],
    timezone: 'UTC',
    ...overrides,
  } as ProfileLike
}

describe('buildSharedContext', () => {
  it('intersects skills case-insensitively and keeps the other casing', () => {
    const context = buildSharedContext(
      viewer({ skills: ['TypeScript', 'Python'] }),
      other({ role: 'designer', skills: ['typescript'] }),
    )
    expect(context.sharedRole).toBeNull()
    expect(context.sharedSkills).toEqual(['typescript'])
    expect(shareReasonLine(context)).toBe('You both know typescript.')
  })

  it('de-duplicates skills that differ only by case or whitespace', () => {
    const context = buildSharedContext(
      viewer({ skills: ['graphql'] }),
      other({
        role: 'designer',
        skills: ['GraphQL', 'graphql', '  GraphQL  ', ''],
      }),
    )
    expect(context.sharedSkills).toEqual(['GraphQL'])
    expect(context.sharedSkills).toHaveLength(1)
  })

  it('reports same timezone only when both sides hold a non-empty timezone', () => {
    const context = buildSharedContext(
      viewer({ role: 'founder', skills: [] }),
      other({ role: 'designer', skills: [] }),
    )
    expect(context.sameTimezone).toBe(true)
    expect(shareReasonLine(context)).toBe("You're both in the same timezone.")
  })

  it('never claims a shared timezone when one side has none (no fabrication)', () => {
    const oneSided = buildSharedContext(
      viewer({ timezone: '' }),
      other({ role: 'designer', skills: [] }),
    )
    expect(oneSided.sameTimezone).toBe(false)
    expect(shareReasonLine(oneSided)).toBeNull()
  })

  it('compares timezones case-insensitively', () => {
    const context = buildSharedContext(
      viewer({ timezone: 'UTC' }),
      other({ role: 'designer', skills: [], timezone: 'utc' }),
    )
    expect(context.sameTimezone).toBe(true)
  })

  it('matches shared roles case-insensitively', () => {
    const context = buildSharedContext(
      viewer({ role: 'Engineer' }),
      other({ role: 'engineer' }),
    )
    expect(context.sharedRole).toBe('engineering')
  })
})

describe('shared-role vs shared-skill priority', () => {
  it('prioritizes the shared role in the reason line and the top starter', () => {
    const context = buildSharedContext(viewer(), other())
    expect(context.sharedRole).toBe('engineering')
    expect(context.sharedSkills).toEqual(['TypeScript'])

    expect(shareReasonLine(context)).toBe('You both work in engineering.')

    const prompts = buildStarterPrompts(context, other())
    expect(prompts[0].key).toBe('shared-role')
    expect(prompts[0].text).toContain('engineering')
    expect(prompts.map((p) => p.key)).toEqual(['shared-role', 'shared-skill'])
  })

  it('falls back to the shared skill when no role is shared', () => {
    const context = buildSharedContext(
      viewer({ role: 'founder' }),
      other({ role: 'designer' }),
    )
    expect(context.sharedRole).toBeNull()
    expect(shareReasonLine(context)).toBe('You both know TypeScript.')

    const prompts = buildStarterPrompts(context, other({ role: 'designer' }))
    expect(prompts[0].key).toBe('shared-skill')
    expect(prompts.map((p) => p.key)).toEqual(['shared-skill', 'role'])
    expect(prompts[1].text).toBe(
      "I'm curious how you got started in Designer.",
    )
  })

  it('does not duplicate a shared role with the other-role prompt', () => {
    const context = buildSharedContext(viewer(), other())
    const keys = buildStarterPrompts(context, other()).map((p) => p.key)
    expect(keys).toContain('shared-role')
    expect(keys).not.toContain('role')
  })
})

describe('deterministic starter order', () => {
  it('is repeatable and ordered for identical inputs', () => {
    const context = buildSharedContext(viewer(), other())
    const expected: StarterPrompt[] = [
      {
        key: 'shared-role',
        source: 'shared_interest',
        text: "Since we're both in engineering, what project are you most excited about right now?",
      },
      {
        key: 'shared-skill',
        source: 'shared_skill',
        text: 'We both have TypeScript — how did you get into that?',
      },
    ]
    expect(buildStarterPrompts(context, other())).toEqual(expected)
    expect(buildStarterPrompts(context, other())).toEqual(expected)
  })

  it('keeps the other-skill order for multi-skill intersections', () => {
    const context = buildSharedContext(
      viewer({ skills: ['A', 'B', 'C', 'D'] }),
      other({ role: 'designer', skills: ['B', 'A'] }),
    )
    const prompts = buildStarterPrompts(context, other({ role: 'designer' }))
    expect(prompts.map((p) => p.key)).toEqual([
      'shared-skill',
      'other-skill',
      'role',
    ])
    expect(prompts[0].text).toContain('B')
    expect(prompts[1].text).toContain('A')
  })
})

describe('MAX_STARTERS cap', () => {
  it('is documented as 3', () => {
    expect(MAX_STARTERS).toBe(3)
  })

  it('caps a large skill intersection at MAX_STARTERS', () => {
    const many = ['A', 'B', 'C', 'D', 'E']
    const context = buildSharedContext(
      viewer({ skills: many }),
      other({ role: 'designer', skills: many }),
    )
    const prompts = buildStarterPrompts(context, other({ role: 'designer' }))
    expect(prompts.length).toBeLessThanOrEqual(MAX_STARTERS)
    expect(prompts).toHaveLength(3)
    expect(prompts.map((p) => p.key)).toEqual([
      'shared-skill',
      'other-skill',
      'role',
    ])
  })

  it('caps the shared role plus many skills at MAX_STARTERS', () => {
    const many = ['A', 'B', 'C', 'D']
    const context = buildSharedContext(
      viewer({ skills: many }),
      other({ skills: many }),
    )
    const prompts = buildStarterPrompts(context, other())
    expect(prompts).toHaveLength(MAX_STARTERS)
    expect(prompts.map((p) => p.key)).toEqual([
      'shared-role',
      'shared-skill',
      'other-skill',
    ])
  })

  it('never emits duplicate keys', () => {
    const many = ['A', 'B', 'C', 'D', 'E']
    const context = buildSharedContext(
      viewer({ skills: many }),
      other({ skills: many }),
    )
    const keys = buildStarterPrompts(context, other()).map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('fallback hello prompt', () => {
  it('is name-based when no shared fact exists', () => {
    const context = buildSharedContext(
      viewer({ role: '', skills: [], timezone: '' }),
      other({ role: '', skills: [], timezone: '' }),
    )
    expect(shareReasonLine(context)).toBeNull()
    expect(hasActionableContext(context)).toBe(false)

    const prompts = buildStarterPrompts(
      context,
      other({ role: '', skills: [], timezone: '' }),
    )
    expect(prompts).toEqual([
      {
        key: 'hello',
        source: 'conversation_gap',
        text: 'Hey Ada, great to match with you!',
      },
    ])
  })

  it('uses a neutral "there" when the other has no usable name', () => {
    const context = buildSharedContext(
      viewer({ role: '', skills: [], timezone: '' }),
      other({ role: '', skills: [], timezone: '' }),
    )
    const prompts = buildStarterPrompts(
      context,
      other({ fullName: '   ', role: '', skills: [], timezone: '' }),
    )
    expect(prompts[0].text).toBe('Hey there, great to match with you!')
  })

  it('still emits a non-empty option when only a timezone is shared', () => {
    const context = buildSharedContext(
      viewer({ role: '', skills: [] }),
      other({ role: '', skills: [], timezone: 'UTC' }),
    )
    expect(context.sameTimezone).toBe(true)
    expect(buildStarterPrompts(context, other({ role: '', skills: [] }))[0].key).toBe(
      'hello',
    )
  })
})

describe('shareReasonLine truthfulness', () => {
  it('claims a reason only when the corresponding fact exists', () => {
    const timezoneOnly = { sharedRole: null, sharedSkills: [], sameTimezone: true }
    expect(shareReasonLine(timezoneOnly)).toBe("You're both in the same timezone.")

    const skillOnly = {
      sharedRole: null,
      sharedSkills: ['React'],
      sameTimezone: false,
    }
    expect(shareReasonLine(skillOnly)).toBe('You both know React.')

    const none = { sharedRole: null, sharedSkills: [], sameTimezone: false }
    expect(shareReasonLine(none)).toBeNull()
  })

  it('only quotes skills from the real intersection', () => {
    const context = buildSharedContext(
      viewer({ skills: ['TypeScript', 'Python'] }),
      other({ role: 'designer', skills: ['Python', 'Rust'] }),
    )
    expect(context.sharedSkills).toEqual(['Python'])
    expect(shareReasonLine(context)).toBe('You both know Python.')
  })
})

describe('buildReminder', () => {
  const base = '2026-09-24T09:00:00.000Z'
  const at = (deltaHours: number): string =>
    new Date(Date.parse(base) + deltaHours * 3_600_000).toISOString()

  it('stays silent below the awaiting-reply threshold', () => {
    expect(buildReminder(base, base)).toBeNull()
    expect(
      buildReminder(base, at(MOMENTUM_THRESHOLDS.awaitingReplyHours - 0.001)),
    ).toBeNull()
  })

  it('fires exactly at the 24h boundary with "yesterday"', () => {
    const reminder = buildReminder(
      base,
      at(MOMENTUM_THRESHOLDS.awaitingReplyHours),
    )
    expect(reminder).not.toBeNull()
    expect(reminder?.source).toBe('conversation_gap')
    expect(reminder?.headline).toBe('You reached out yesterday.')
    expect(reminder?.nudge).toBe('Want to pick it back up?')
  })

  it('labels the elapsed time with the right relative day', () => {
    expect(buildReminder(base, at(48))?.headline).toBe(
      'You reached out 2 days ago.',
    )
    expect(buildReminder(base, at(96))?.headline).toContain('4 days ago')
  })

  it('applies the conversation-gap headline only at/over the gap threshold', () => {
    const gap = buildReminder(
      base,
      at(MOMENTUM_THRESHOLDS.conversationGapHours),
    )
    expect(gap?.headline).toBe(
      "It's been a while since you reached out (3 days ago).",
    )

    const justUnder = buildReminder(
      base,
      at(MOMENTUM_THRESHOLDS.conversationGapHours - 0.001),
    )
    expect(justUnder?.headline).not.toContain("It's been a while")
    expect(justUnder?.headline).toBe('You reached out 2 days ago.')
  })

  it('returns null for unparseable timestamps (fail-safe)', () => {
    expect(buildReminder('not-a-date', at(48))).toBeNull()
    expect(buildReminder(base, 'not-a-date')).toBeNull()
  })
})

describe('formatRole', () => {
  it('title-cases known role enums and tolerates surrounding whitespace', () => {
    expect(formatRole('data_ml')).toBe('Data & ML')
    expect(formatRole('  founder ')).toBe('Founder')
    expect(formatRole('DATA_ML')).toBe('Data & ML')
  })

  it('keeps unknown roles readable and empty roles empty', () => {
    expect(formatRole('Product Lead')).toBe('Product Lead')
    expect(formatRole('')).toBe('')
    expect(formatRole('   ')).toBe('')
  })
})