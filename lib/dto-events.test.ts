// lib/dto-events.test.ts
import { describe, it, expect } from 'vitest'

import {
  clampGuestLimit,
  decodeGuestEventsCursor,
  encodeGuestEventsCursor,
  toGuestEventDetailDTO,
  EMPTY_GUEST_EVENT_COUNTS,
  type GuestEventDetailRow,
} from '@/lib/dto-events'

describe('clampGuestLimit', () => {
  it('defaults to 20 when undefined', () => {
    expect(clampGuestLimit(undefined)).toBe(20)
  })

  it('clamps to the 1..50 contract', () => {
    expect(clampGuestLimit(0)).toBe(1)
    expect(clampGuestLimit(-5)).toBe(1)
    expect(clampGuestLimit(51)).toBe(50)
    expect(clampGuestLimit(999)).toBe(50)
  })

  it('truncates non-integers and rejects non-finite values', () => {
    expect(clampGuestLimit(13.9)).toBe(13)
    expect(clampGuestLimit(Number.NaN)).toBe(20)
    expect(clampGuestLimit(Number.POSITIVE_INFINITY)).toBe(20)
  })
})

describe('guest events cursor round-trip', () => {
  it('encodes then decodes to the same keyset', () => {
    const cursor = encodeGuestEventsCursor(
      '2026-09-21T10:00:00.000Z',
      '123e4567-e89b-12d3-a456-426614174000',
    )
    expect(decodeGuestEventsCursor(cursor)).toEqual({
      startsAt: '2026-09-21T10:00:00.000Z',
      id: '123e4567-e89b-12d3-a456-426614174000',
    })
  })

  it('returns null for malformed input', () => {
    expect(decodeGuestEventsCursor(undefined)).toBeNull()
    expect(decodeGuestEventsCursor('')).toBeNull()
    expect(decodeGuestEventsCursor('not-base64!!')).toBeNull()
    expect(decodeGuestEventsCursor('a'.repeat(500))).toBeNull()
    expect(decodeGuestEventsCursor('e30=')).toBeNull() // '{}'
    expect(
      decodeGuestEventsCursor(btoa(JSON.stringify({ s: 1, i: 2 }))),
    ).toBeNull()
  })
})

describe('toGuestEventDetailDTO', () => {
  const row: GuestEventDetailRow = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Community Build Night',
    description: 'A working session for builders.',
    type: 'irl',
    format: 'build_night',
    location_or_link: 'The Greenhouse, Berlin',
    starts_at: '2026-09-21T10:00:00.000Z',
    duration_minutes: 120,
    capacity: 40,
    tags: ['build', 'night'],
    cover_image: null,
    timezone: 'Europe/Berlin',
    venue: { name: 'The Greenhouse' },
    price: 0,
    currency: 'INR',
    category: 'technology',
  }

  it('maps a row through the detail DTO', () => {
    const dto = toGuestEventDetailDTO(row, {
      capacity: 40,
      registeredCount: 12,
      waitlistCount: 3,
      registrationOpen: true,
    })
    expect(dto.id).toBe(row.id)
    expect(dto.type).toBe('irl')
    expect(dto.format).toBe('build_night')
    expect(dto.startsAt).toBe('2026-09-21T10:00:00.000Z')
    expect(dto.durationMinutes).toBe(120)
    expect(dto.registeredCount).toBe(12)
    expect(dto.waitlistCount).toBe(3)
    expect(dto.spotsRemaining).toBe(28)
    expect(dto.isFull).toBe(false)
  })

  it('derives full state when registeredCount reaches capacity', () => {
    const dto = toGuestEventDetailDTO(row, {
      capacity: 40,
      registeredCount: 40,
      waitlistCount: 2,
      registrationOpen: true,
    })
    expect(dto.spotsRemaining).toBe(0)
    expect(dto.isFull).toBe(true)
  })

  it('degrades to all-null counts when no metrics are provided', () => {
    const dto = toGuestEventDetailDTO(row, null)
    expect(dto.registeredCount).toBeNull()
    expect(dto.waitlistCount).toBeNull()
    expect(dto.spotsRemaining).toBeNull()
    expect(dto.isFull).toBeNull()
    expect(dto.registrationOpen).toBeNull()
  })

  it('falls back to the empty counts constant', () => {
    const dto = toGuestEventDetailDTO({ id: row.id, title: row.title })
    expect(dto.spotsRemaining).toBe(EMPTY_GUEST_EVENT_COUNTS.spotsRemaining)
    expect(dto.registeredCount).toBe(EMPTY_GUEST_EVENT_COUNTS.registeredCount)
    expect(dto.capacity).toBe(0)
  })
})
