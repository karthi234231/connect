begin;

-- S45 — analytics event fields (correlationId).
-- Consistency with the audit layer's request-tracing convention (#159): every
-- analytics event carries an optional correlation_id so events originating from
-- the same user action can be joined across services. Producers stamp a fresh
-- uuid when the caller does not supply one (see funnel.ts normalizeFunnelPayload).
alter table public.analytics_events
  add column if not exists correlation_id text;

-- Join funnel events back to a specific traced action.
create index if not exists analytics_events_correlation_idx
  on public.analytics_events (correlation_id, created_at desc);

commit;