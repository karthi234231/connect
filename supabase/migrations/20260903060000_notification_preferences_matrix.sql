begin;

-- ============================================================
-- S028 — Notification preferences: channel matrix, quiet hours, digests
-- Extends the S025 canonical domain. Never renames existing objects.
-- ============================================================

-- Channel + digest semantics (deterministic taxonomy)
create type public.notification_channel as enum ('in_app', 'email', 'push');
create type public.notification_digest_cadence as enum ('never', 'daily', 'weekly');

-- ------------------------------------------------------------
-- 1. notification_preferences — extend per-type toggle to a channel matrix.
--    `enabled` remains the master per-type toggle (turn all channels off at once).
--    per-type channel flags further restrict which channel may carry the type.
-- ------------------------------------------------------------
alter table public.notification_preferences
  add column in_app boolean not null default true,
  add column email  boolean not null default true,
  add column push   boolean not null default true;

-- ------------------------------------------------------------
-- 2. notification_settings — per-user quiet hours + digest cadence.
--    Primary key is user_id (one settings row per user, lazily inserted).
-- ------------------------------------------------------------
create table public.notification_settings (
  user_id              uuid primary key references public.profiles (id) on delete cascade,
  quiet_hours_enabled  boolean not null default false,
  quiet_hours_start    time default null,
  quiet_hours_end      time default null,
  quiet_hours_timezone text not null default 'UTC',
  digest_cadence       public.notification_digest_cadence not null default 'never',
  digest_hour          int not null default 9,
  digest_timezone      text not null default 'UTC',
  security_alerts      boolean not null default true,
  updated_at           timestamptz not null default now()
);

create trigger notification_settings_touch_updated_at
  before update on public.notification_settings
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 3. RLS + grants
-- ------------------------------------------------------------
alter table public.notification_settings enable row level security;

create policy notification_settings_self_read
  on public.notification_settings for select
  to authenticated
  using (user_id = auth.uid());

create policy notification_settings_self_insert
  on public.notification_settings for insert
  to authenticated
  with check (user_id = auth.uid());

create policy notification_settings_self_update
  on public.notification_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.notification_settings to authenticated;
grant all on public.notification_settings to service_role;

commit;