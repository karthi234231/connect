// src/services/alerts/alerts.repository.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Alert, CreateAlertInput } from './alerts.types'

export interface AlertsRepository {
  listForUser(userId: string, limit?: number): Promise<Alert[]>
  listActiveForUser(userId: string, limit?: number): Promise<Alert[]>
  getUnacknowledgedCount(userId: string): Promise<number>
  insert(input: CreateAlertInput): Promise<Alert | null>
  acknowledge(alertId: string, userId: string): Promise<void>
}

const COLUMNS =
  'id,user_id,severity,source,title,body,link,dedupe_key,is_security,expires_at,acknowledged_at,created_at'

// The `alerts` table is intentionally not part of the generated schema types,
// so the PostgREST chain is bound to this minimal structural type.
type LooseQuery = PromiseLike<{
  data: unknown
  error: {
    message: string
    code?: string
    details?: string
    hint?: string
  } | null
  count?: number | null
}> & {
  select: (columns: string, options?: unknown) => LooseQuery
  eq: (column: string, value: unknown) => LooseQuery
  is: (column: string, value: unknown) => LooseQuery
  or: (filters: string) => LooseQuery
  order: (column: string, options?: unknown) => LooseQuery
  limit: (limit: number) => LooseQuery
  maybeSingle: () => LooseQuery
  single: () => LooseQuery
  insert: (row: unknown) => LooseQuery
  update: (values: unknown) => LooseQuery
}

type LooseTable = {
  from: (table: string) => LooseQuery
}

export function createAlertsRepository(
  client: SupabaseClient,
): AlertsRepository {
  const table = (client as unknown as LooseTable).from('alerts')

  return {
    async listForUser(userId, limit = 50): Promise<Alert[]> {
      const { data, error } = await table
        .select(COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as Alert[]
    },

    async listActiveForUser(userId, limit = 20): Promise<Alert[]> {
      const { data, error } = await table
        .select(COLUMNS)
        .eq('user_id', userId)
        .is('acknowledged_at', null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as Alert[]
    },

    async getUnacknowledgedCount(userId): Promise<number> {
      const { count, error } = await table
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('acknowledged_at', null)
      if (error) throw error
      return count ?? 0
    },

    async insert(input: CreateAlertInput): Promise<Alert | null> {
      if (input.dedupeKey && input.userId) {
        const { data: existing } = await table
          .select('id')
          .eq('user_id', input.userId)
          .eq('dedupe_key', input.dedupeKey)
          .maybeSingle()
        if (existing) return null
      }
      const row = {
        user_id: input.userId,
        severity: input.severity,
        source: input.source,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        dedupe_key: input.dedupeKey ?? null,
        is_security: input.isSecurity ?? false,
        expires_at: input.expiresAt ?? null,
      }
      const { data, error } = await table.insert(row).select(COLUMNS).single()
      if (error) throw error
      return data as Alert
    },

    async acknowledge(alertId, userId): Promise<void> {
      const { error } = await table
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', alertId)
        .eq('user_id', userId)
      if (error) throw error
    },
  }
}
