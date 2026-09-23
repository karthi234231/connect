// services/guest/browse.service.test.ts
// Pure, deterministic helpers exported from the guest browse service. These do
// not touch Supabase or env — they are the mapping + identity helpers the pages
// and client layer rely on for shape normalization.
import { describe, it, expect } from 'vitest'

import {
  guestSessionId,
  toGuestEventDTO,
  toGuestIdeaDTO,
} from './browse.service'

describe('guestSessionId', () => {
  it('mints an analytics-only identity for a well-formed token', () => {
    expect(guestSessionId('aaaaaaaaaaaaaaaa')).toBe('guest:aaaaaaaaaaaaaaaa')
  })

  it('collapses a missing token to the unidentified guest bucket', () => {
    expect(guestSessionId(undefined)).toBe('guest:unidentified')
    expect(guestSessionId(null)).toBe('guest:unidentified')
    expect(guestSessionId('')).toBe('guest:unidentified')
  })

  it('rejects tokens that fail the shape guard (too short / bad chars)', () => {
    expect(guestSessionId('ab')).toBe('guest:unidentified')
    expect(guestSessionId('has spaces in it')).toBe('guest:unidentified')
    expect(guestSessionId('!@#$%^&*()')).toBe('guest:unidentified')
  })
})

describe('toGuestEventDTO', () => {
  const base = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Community Build Night',
    type: 'irl',
    format: 'build_night',
    starts_at: '2026-09-21T10:00:00.000Z',
    duration_minutes: 120,
    capacity: 40,
    tags: ['build', 'night'],
    attendee_count: 7,
  }

  it('maps an IRL row fields-through with the correct type', () => {
    const dto = toGuestEventDTO(base)
    expect(dto).toEqual({
      id: base.id,
      title: base.title,
      type: 'irl',
      format: 'build_night',
      locationOrLink: null,
      startsAt: '2026-09-21T10:00:00.000Z',
      durationMinutes: 120,
      capacity: 40,
      attendeeCount: 7,
      tags: ['build', 'night'],
    })
  })

  it('normalizes a null/blank type to virtual and applies row defaults', () => {
    const dto = toGuestEventDTO({ id: base.id, title: base.title })
    expect(dto.type).toBe('virtual')
    expect(dto.format).toBe('social')
    expect(dto.startsAt).toBe(new Date(0).toISOString())
    expect(dto.durationMinutes).toBe(60)
    expect(dto.capacity).toBe(0)
    expect(dto.tags).toEqual([])
    expect(dto.attendeeCount).toBe(0)
    expect(dto.locationOrLink).toBeNull()
  })
})

describe('toGuestIdeaDTO', () => {
  const base = {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'A new idea',
    problem: 'People can’t find each other.',
    solution: 'A directory with presence.',
    ask: 'Co-founder and an engineer.',
    stage: 'traction',
    team_needed: ['co-founder', 'engineer'],
    tags: ['marketplace'],
    join_enabled: true,
    validation_count: 3,
    image_url: 'https://example.com/banner.png',
    created_at: '2026-09-21T08:00:00.000Z',
  }

  it('maps a complete idea row', () => {
    expect(toGuestIdeaDTO(base)).toEqual({
      id: base.id,
      title: base.title,
      problem: base.problem,
      solution: base.solution,
      ask: base.ask,
      stage: base.stage,
      teamNeeded: ['co-founder', 'engineer'],
      tags: ['marketplace'],
      joinEnabled: true,
      validationCount: 3,
      imageUrl: 'https://example.com/banner.png',
      createdAt: base.created_at,
    })
  })

  it('applies safe defaults for sparse rows', () => {
    const dto = toGuestIdeaDTO(base)
    expect(dto).toEqual(
      expect.objectContaining({
        joinEnabled: true,
        validationCount: 3,
      }),
    )
  })
})
