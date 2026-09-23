begin;

-- ============================================================
-- S022 — Analytics persistence contract
-- Appendix-only raw events (analytics_events) + daily aggregates (analytics_daily)
-- Backed by Redis buffer (trackFunnel) → flushAnalyticsBuffer (admin/service_role)
-- ============================================================

-- ------------------------------------------------------------
-- 1. analytics_events — append-only raw funnel events
-- ------------------------------------------------------------
create table public.analytics_events (
  id            uuid primary key default gen_random_uuid(),
  event_name    text not null,
  actor_id      text, -- authenticated uuid or anonymous guest session id (no FK: guest ids arena profiles)
  surface       text,
  entity_type   text,
  entity_id     text,
  profile_state text,
  role          text,
  latency_ms    integer,
  result        text,
  error_code    text,
  created_at    timestamptz not null default now()
);

-- Traction/queries: newest events first; per-event time series.
create index analytics_events_created_at_idx
  on public.analytics_events (created_at desc);
create index analytics_events_event_created_idx
  on public.analytics_events (event_name, created_at desc);
create index analytics_events_actor_created_idx
  on public.analytics_events (actor_id, created_at desc);

-- ------------------------------------------------------------
-- 2. analytics_daily — daily per-event rollup forinvestor traction dashboard
-- ------------------------------------------------------------
create table public.analytics_daily (
  day         date not null,
  event_name  text not null,
  count       bigint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (day, event_name)
);

-- ------------------------------------------------------------
-- 3. RLS — analytics
-- ------------------------------------------------------------
alter table public.analytics_events enable row level security;
alter table public.analytics_daily enable row level security;

create policy analytics_events_admin_read
on public.analytics_events
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.app_role = 'admin'
  )
);

create policy analytics_daily_admin_read
on public.analytics_daily
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.app_role = 'admin'
  )
);

-- Writes flow via admin/service_role client (flushAnalyticsBuffer) which bypasses RLS.
-- No direct authenticated insert policies.

-- ------------------------------------------------------------
-- 4. Grants
-- ------------------------------------------------------------
grant select on public.analytics_events to authenticated;
grant select on public.analytics_daily to authenticated;

grant all on public.analytics_events to service_role;
grant all on public.analytics_daily to service_role;

commit;