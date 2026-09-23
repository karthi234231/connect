begin;

-- ============================================================
-- S029 — Alerts and system-safety notification taxonomy
-- Durable user alerts with a deterministic severity model, distinct
-- from the generic notification inbox and transient toasts.
-- ============================================================

create type public.alert_severity as enum ('info', 'success', 'warning', 'critical');
create type public.alert_source as enum (
  'system',
  'security',
  'moderation',
  'account',
  'safety'
);

create table public.alerts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles (id) on delete cascade,
  severity         public.alert_severity not null default 'info',
  source           public.alert_source not null default 'system',
  title            text not null,
  body             text,
  link             text,
  dedupe_key       text,
  is_security      boolean not null default false,
  expires_at       timestamptz,
  acknowledged_at  timestamptz,
  created_at       timestamptz not null default now(),
  -- At most one live (unexpired, unacknowledged) alert per user+dedupe key.
  constraint alerts_dedupe_partial unique (user_id, dedupe_key)
    deferrable initially immediate
);

-- Open (unacknowledged) alerts per user, newest first — banner query.
-- NOTE: predicates must be IMMUTABLE; expiry filtering (expires_at > now()) is applied
-- as a query-time filter by the alerts repository, so the partial index narrows on
-- the stable condition only (acknowledged_at is null).
create index alerts_user_created_idx
  on public.alerts (user_id, created_at desc);
create index alerts_user_open_idx
  on public.alerts (user_id, created_at desc)
  where acknowledged_at is null;

-- ------------------------------------------------------------
-- RLS + grants
-- ------------------------------------------------------------
alter table public.alerts enable row level security;

create policy alerts_self_read
  on public.alerts for select
  to authenticated
  using (user_id = auth.uid());

create policy alerts_self_insert
  on public.alerts for insert
  to authenticated
  with check (user_id = auth.uid());

create policy alerts_self_update
  on public.alerts for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.alerts to authenticated;
grant all on public.alerts to service_role;

commit;