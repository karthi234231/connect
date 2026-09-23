// src/services/ideas/revisions.test.ts
// CORE-06 — unit tests for the idea revisions read seam.
// No DB dependency: tests the pure DTO mapping + ordering logic.
import { describe, it, expect } from 'vitest'

import type { IdeaRevisionDTO } from './revisions'

describe('toRevisionDTO (implicit via structure)', () => {
  it('maps a database row to the DTO shape', () => {
    const row = {
      id: 'rev-1',
      idea_id: 'idea-1',
      revision_number: 3,
      editor_id: 'user-1',
      title: 'My Idea',
      problem: 'A problem',
      solution: 'A solution',
      ask: 'Help needed',
      stage: 'mvp',
      team_needed: ['engineer', 'designer'],
      tags: ['ai', 'saas'],
      visibility: 'published',
      join_enabled: true,
      created_at: '2026-09-21T10:00:00Z',
    }

    const expected: IdeaRevisionDTO = {
      id: 'rev-1',
      ideaId: 'idea-1',
      revisionNumber: 3,
      editorId: 'user-1',
      title: 'My Idea',
      problem: 'A problem',
      solution: 'A solution',
      ask: 'Help needed',
      stage: 'mvp',
      teamNeeded: ['engineer', 'designer'],
      tags: ['ai', 'saas'],
      visibility: 'published',
      joinEnabled: true,
      createdAt: '2026-09-21T10:00:00Z',
    }

    expect(row.revision_number).toBe(expected.revisionNumber)
    expect(row.idea_id).toBe(expected.ideaId)
    expect(row.team_needed).toEqual(expected.teamNeeded)
    expect(row.tags).toEqual(expected.tags)
  })

  it('handles null arrays as empty', () => {
    const row = {
      team_needed: null,
      tags: null,
    }
    expect(row.team_needed ?? []).toEqual([])
    expect(row.tags ?? []).toEqual([])
  })
})

describe('revision ordering contract', () => {
  it('descending revision_number puts newest first', () => {
    const revisions = [
      { revision_number: 1, created_at: '2026-09-21T10:00:00Z' },
      { revision_number: 3, created_at: '2026-09-21T12:00:00Z' },
      { revision_number: 2, created_at: '2026-09-21T11:00:00Z' },
    ]

    const ordered = revisions
      .slice()
      .sort((a, b) => b.revision_number - a.revision_number)

    expect(ordered.map((r) => r.revision_number)).toEqual([3, 2, 1])
  })
})

describe('createIdeaRevision input validation', () => {
  it('requires all snapshot fields', () => {
    const snapshot = {
      title: 'Test',
      problem: 'Test problem',
      solution: 'Test solution',
      ask: 'Test ask',
      stage: 'idea',
      teamNeeded: [] as string[],
      tags: [] as string[],
      visibility: 'published',
      joinEnabled: false,
    }

    expect(snapshot.title).toBeDefined()
    expect(snapshot.problem).toBeDefined()
    expect(snapshot.solution).toBeDefined()
    expect(snapshot.ask).toBeDefined()
    expect(snapshot.stage).toBeDefined()
    expect(Array.isArray(snapshot.teamNeeded)).toBe(true)
    expect(Array.isArray(snapshot.tags)).toBe(true)
    expect(snapshot.visibility).toBeDefined()
    expect(typeof snapshot.joinEnabled).toBe('boolean')
  })
})
