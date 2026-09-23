// lib/dto-admin.test.ts
// Admin DTO mappers + the pure keyset-cursor helpers shared by the admin
// console pages. Nothing here touches the DB — all inputs are plain rows.
import { describe, expect, it } from 'vitest'

import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  toAdminAuditLogDTO,
  toAdminEventRowDTO,
  toAdminUserRowDTO,
} from './dto-admin'

describe('keyset cursor helpers', () => {
  it('decodes undefined/null cursors to an empty keyset', () => {
    expect(decodeKeysetCursor(undefined)).toEqual({
      sortValue: null,
      id: null,
    })
    expect(decodeKeysetCursor(null)).toEqual({ sortValue: null, id: null })
  })

  it('decodes a "sortValue|id" token', () => {
    expect(decodeKeysetCursor('2026-09-21T00:00:00.000Z|abc')).toEqual({
      sortValue: '2026-09-21T00:00:00.000Z',
      id: 'abc',
    })
  })

  it('treats a one-part token as sortValue with no id', () => {
    expect(decodeKeysetCursor('drift')).toEqual({
      sortValue: 'drift',
      id: null,
    })
  })

  it('ignores anything after the second separator', () => {
    expect(decodeKeysetCursor('a|b|c')).toEqual({ sortValue: 'a', id: 'b' })
  })

  it('round-trips through encode', () => {
    expect(encodeKeysetCursor('k', 'id-1')).toBe('k|id-1')
    expect(
      decodeKeysetCursor(encodeKeysetCursor('2026-01-01', 'id-1')),
    ).toEqual({ sortValue: '2026-01-01', id: 'id-1' })
  })
})

describe('admin event DTO', () => {
  it('maps the audit columns and keeps capacity numeric', () => {
    expect(
      toAdminEventRowDTO({
        id: '00000000-0000-4000-8000-000000000001',
        title: 'Build night',
        status: 'published',
        visibility: 'public',
        organizer_id: '00000000-0000-4000-8000-000000000002',
        starts_at: '2026-09-21T18:00:00.000Z',
        created_at: '2026-09-01T00:00:00.000Z',
        capacity: 40,
      }),
    ).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Build night',
      status: 'published',
      visibility: 'public',
      organizerId: '00000000-0000-4000-8000-000000000002',
      startsAt: '2026-09-21T18:00:00.000Z',
      createdAt: '2026-09-01T00:00:00.000Z',
      capacity: 40,
    })
  })
})

describe('admin audit-log DTO', () => {
  it('maps raw audit_logs rows, tolerating a null actor', () => {
    expect(
      toAdminAuditLogDTO({
        id: '00000000-0000-4000-8000-000000000003',
        actor_id: null,
        action: 'user.suspended',
        entity_type: 'user',
        entity_id: '00000000-0000-4000-8000-000000000002',
        created_at: '2026-09-01T00:00:00.000Z',
      }),
    ).toEqual({
      id: '00000000-0000-4000-8000-000000000003',
      actorId: null,
      action: 'user.suspended',
      entityType: 'user',
      entityId: '00000000-0000-4000-8000-000000000002',
      createdAt: '2026-09-01T00:00:00.000Z',
    })
  })
})

describe('admin user DTO', () => {
  it('derives isSuspended from suspended_at presence', () => {
    const base = {
      id: '00000000-0000-4000-8000-000000000004',
      full_name: 'Ada Lovelace',
      role: 'admin',
      created_at: '2026-01-01T00:00:00.000Z',
      last_active_at: '2026-02-01T00:00:00.000Z',
    }
    expect(toAdminUserRowDTO({ ...base, suspended_at: null }).isSuspended).toBe(
      false,
    )
    expect(
      toAdminUserRowDTO({ ...base, suspended_at: '2026-03-01T00:00:00.000Z' })
        .isSuspended,
    ).toBe(true)
  })
})
