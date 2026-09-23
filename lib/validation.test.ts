// lib/validation.test.ts
// Validation is the boundary between untrusted input and the database, so the
// schema contracts that guard server actions get locked down here.
import { describe, expect, it } from 'vitest'

import {
  availabilitySchema,
  createEventSchema,
  emailSchema,
  nameSchema,
  normalizedTagListSchema,
  passwordSchema,
  rsvpSchema,
  sendMessageSchema,
  uuidSchema,
} from '@/lib/validation'

const VALID_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

describe('emailSchema', () => {
  it('lowercases and trims before storing', () => {
    expect(emailSchema.parse('  Person@Example.COM ')).toBe(
      'person@example.com',
    )
  })

  it('rejects malformed addresses', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false)
    expect(emailSchema.safeParse('a@b').success).toBe(false)
  })
})

describe('passwordSchema', () => {
  it('accepts a mixed-case password with a digit', () => {
    expect(passwordSchema.safeParse('Sup3rSecret').success).toBe(true)
  })

  it.each([
    ['too short', 'Abc123'],
    ['no uppercase', 'sup3rsecret'],
    ['no lowercase', 'SUP3RSECRET'],
    ['no digit', 'SuperSecret'],
  ])('rejects %s', (_label, value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false)
  })
})

describe('primitive schemas', () => {
  it('accepts canonical UUIDs only', () => {
    expect(uuidSchema.safeParse(VALID_UUID).success).toBe(true)
    expect(uuidSchema.safeParse('42').success).toBe(false)
  })

  it('rejects digits and symbols in names', () => {
    expect(nameSchema.safeParse("Anne-Marie O'Neill").success).toBe(true)
    expect(
      nameSchema.safeParse('Robert"); DROP TABLE profiles;--').success,
    ).toBe(false)
  })
})

describe('normalizedTagListSchema', () => {
  const schema = normalizedTagListSchema({ max: 3, label: 'interests' })

  it('trims, lowercases and de-duplicates', () => {
    expect(schema.parse([' React ', 'react', 'TYPESCRIPT'])).toEqual([
      'react',
      'typescript',
    ])
  })

  it('enforces the cap after normalisation', () => {
    expect(schema.safeParse(['a', 'b', 'c', 'd']).success).toBe(false)
  })
})

describe('availabilitySchema', () => {
  it('requires the start of the window to precede the end', () => {
    expect(
      availabilitySchema.safeParse({
        days: ['mon'],
        hours: { start: '09:00', end: '11:00' },
      }).success,
    ).toBe(true)

    expect(
      availabilitySchema.safeParse({
        days: ['mon'],
        hours: { start: '18:00', end: '09:00' },
      }).success,
    ).toBe(false)
  })
})

describe('sendMessageSchema', () => {
  it('accepts a scoped attachment path', () => {
    const result = sendMessageSchema.safeParse({
      matchId: VALID_UUID,
      content: 'hello',
      clientMessageId: VALID_UUID,
      attachmentUrl: `match-attachments/${VALID_UUID}/3f2504e0-4f89-41d3-9a0c-0305e82c3302.pdf`,
    })

    expect(result.success).toBe(true)
  })

  it('rejects an arbitrary external URL', () => {
    const result = sendMessageSchema.safeParse({
      matchId: VALID_UUID,
      content: 'hello',
      clientMessageId: VALID_UUID,
      attachmentUrl: 'https://evil.example/payload.exe',
    })

    expect(result.success).toBe(false)
  })

  it('rejects an empty body', () => {
    expect(
      sendMessageSchema.safeParse({
        matchId: VALID_UUID,
        content: '',
        clientMessageId: VALID_UUID,
      }).success,
    ).toBe(false)
  })
})

describe('createEventSchema', () => {
  const base = {
    title: 'Build night',
    description: 'Ship something small with new people.',
    type: 'irl',
    format: 'build_night',
    locationOrLink: 'Shoreditch',
    startsAt: new Date('2026-10-01T18:00:00.000Z').toISOString(),
    durationMinutes: 120,
    capacity: 30,
  }

  it('accepts a well-formed event and defaults recurrence', () => {
    const parsed = createEventSchema.parse(base)
    expect(parsed.recurrence).toBe('none')
  })

  it('rejects an out-of-range duration', () => {
    expect(
      createEventSchema.safeParse({ ...base, durationMinutes: 5 }).success,
    ).toBe(false)
    expect(
      createEventSchema.safeParse({ ...base, durationMinutes: 1000 }).success,
    ).toBe(false)
  })
})

describe('rsvpSchema', () => {
  it('accepts only the two terminal RSVP states', () => {
    expect(
      rsvpSchema.safeParse({ eventId: VALID_UUID, status: 'going' }).success,
    ).toBe(true)
    expect(
      rsvpSchema.safeParse({ eventId: VALID_UUID, status: 'maybe' }).success,
    ).toBe(false)
  })
})
