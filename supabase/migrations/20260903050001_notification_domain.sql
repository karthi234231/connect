begin;

-- ============================================================
-- S025 — Notification data model & event taxonomy
-- Canonical notification domain (replaces profile.notification_prefs JSON)
-- ============================================================

-- Notification type enum (event taxonomy)
create type public.notification_type as enum (
  'match_created',
  'intro_requested',
  'message_received',
  'event_reminder',
  'event_group_assigned'
);

-- ------------------------------------------------------------
-- 1. notification_preferences — per-user, per-type toggles
-- ------------------------------------------------------------
create table public.notification_preferences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        public.notification_type not null,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint notification_preferences_user_type_unique unique (user_id, type)
);

create index notification_preferences_user_idx
  on public.notification_preferences (user_id);

create trigger notification_preferences_touch_updated_at
  before update on public.notification_preferences
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 2. notifications — canonical inbox rows
-- ------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  type         public.notification_type not null,
  entity_type  text,
  entity_id    uuid,
  title        text not null,
  body         text,
  read_at      timestamptz,
  dedupe_key   text,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;
create index notifications_dedupe_idx
  on public.notifications (dedupe_key)
  where dedupe_key is not null;

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;

create policy notification_preferences_self_read
  on public.notification_preferences for select
  to authenticated
  using (user_id = auth.uid());

create policy notification_preferences_self_insert
  on public.notification_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

create policy notification_preferences_self_update
  on public.notification_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_self_read
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy notifications_self_insert
  on public.notifications for insert
  to authenticated
  with check (user_id = auth.uid());

create policy notifications_self_update
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- 4. Grants
-- ------------------------------------------------------------
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant all on public.notification_preferences to service_role;
grant all on public.notifications to service_role;

-- ------------------------------------------------------------
-- 5. Backfill preferences from existing profile.notification_prefs JSON
-- ------------------------------------------------------------
insert into public.notification_preferences (user_id, type, enabled)
select
  p.id,
  nt.type::public.notification_type,
  coalesce((p.notification_prefs ->> nt.type)::boolean, true)
from public.profiles p
cross join (
  values
    ('match_created'),
    ('intro_requested'),
    ('message_received'),
    ('event_reminder'),
    ('event_group_assigned')
) as nt(type)
on conflict (user_id, type) do nothing;

commit;