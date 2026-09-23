// tests/units/chat-inbox-filter.test.ts
// Regression guard for the S24 chat inbox participant filter
// (services/chat/chat.service.ts → getInbox).
//
// The PostgREST scoping rule this locks in:
//   • On `chat_threads`, `user1_id`/`user2_id` belong to the EMBEDDED `matches`
//     relation, so the filter must be the plain column list plus
//     `{ referencedTable: 'matches' }`. Writing `matches.user1_id.eq.<id>` in a
//     top-level `.or()` is NOT embedded-column syntax — PostgREST rejects the
//     whole logic tree with PGRST100 ("failed to parse logic tree"), which
//     surfaced as a 500 from getInboxAction and an empty dashboard inbox.
//   • On `matches` those columns are direct, so no option is passed.
//
// The Supabase server client is faked, so this stays a pure unit test: the fake
// records every `.or()` argument (and the select projection) and resolves empty
// result sets, so no database is required.

import { beforeEach, describe, expect, it, vi } from 'vitest'

interface OrCall {
  filter: string
  options?: { referencedTable?: string }
}

interface QueryRecord {
  table: string
  select: string | null
  orCalls: OrCall[]
}

const harness = vi.hoisted(() => {
  const queries: QueryRecord[] = []

  function recordingBuilder(table: string): Record<string, unknown> {
    const record: QueryRecord = { table, select: null, orCalls: [] }
    queries.push(record)

    const builder = new Proxy({} as Record<string, unknown>, {
      get(_target, property) {
        if (property === 'then') {
          // Awaited exactly like a PostgREST builder: { data, error }.
          return (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null }).then(resolve)
        }

        return (...args: unknown[]) => {
          if (property === 'select' && typeof args[0] === 'string') {
            record.select = args[0]
          }

          if (property === 'or' && typeof args[0] === 'string') {
            record.orCalls.push({
              filter: args[0],
              options: args[1] as OrCall['options'],
            })
          }

          return builder
        }
      },
    })

    return builder
  }

  return { queries, recordingBuilder }
})

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    from: (table: string) => harness.recordingBuilder(table),
  }),
}))

const { getInbox } = await import('@/services/chat/chat.service')

const USER_ID = '00000000-0000-0000-0000-00000000000a'
const PARTICIPANT_FILTER = `user1_id.eq.${USER_ID},user2_id.eq.${USER_ID}`

/** `table.column.operator.` — a table-qualified column, never valid in `.or()`. */
const TABLE_QUALIFIED_COLUMN =
  /(?:^|[(,])\w+\.\w+\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in)\./

beforeEach(() => {
  harness.queries.length = 0
})

describe('getInbox — participant filter scoping', () => {
  it('filters chat_threads through the embedded relation, unprefixed', async () => {
    await getInbox(USER_ID)

    const threadQuery = harness.queries.find((q) => q.table === 'chat_threads')

    expect(threadQuery).toBeDefined()
    // The participant filter is only meaningful against the embedded relation.
    expect(threadQuery?.select).toContain('matches!inner(')

    const participantOr = threadQuery?.orCalls.find((call) =>
      call.filter.includes('user1_id'),
    )

    expect(participantOr).toBeDefined()
    expect(participantOr?.filter).toBe(PARTICIPANT_FILTER)
    expect(participantOr?.options).toEqual({ referencedTable: 'matches' })
    // The dotted form is the PGRST100 trigger, not embedded syntax.
    expect(participantOr?.filter).not.toContain('matches.')
  })

  it('omits referencedTable when filtering the matches table directly', async () => {
    await getInbox(USER_ID)

    const matchQuery = harness.queries.find((q) => q.table === 'matches')

    expect(matchQuery).toBeDefined()
    expect(matchQuery?.orCalls).toHaveLength(1)
    expect(matchQuery?.orCalls[0].filter).toBe(PARTICIPANT_FILTER)
    expect(matchQuery?.orCalls[0].options).toBeUndefined()
  })

  it('never emits a table-qualified column inside any top-level .or()', async () => {
    await getInbox(USER_ID)

    const offenders = harness.queries.flatMap((query) =>
      query.orCalls
        .filter((call) => TABLE_QUALIFIED_COLUMN.test(call.filter))
        .map((call) => `${query.table}: ${call.filter}`),
    )

    expect(offenders).toEqual([])
  })
})
