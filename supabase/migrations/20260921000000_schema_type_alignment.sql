-- 20260921000000_schema_type_alignment.sql
-- Schema ↔ types/database.ts alignment: add the tables + enum values that
-- exist in one place but not the other. Code-first audit 2026-09-21:
--
--   1. message_reactions .......... migration 20260916010000 exists,
--      types/database.ts MISSING → add table block (reaction.service.ts uses
--      an untyped facade only because types predate the table).
--   2. swipe_daily_quota .......... migration 20260915000000 exists,
--      types/database.ts MISSING → add table block (matches.ts uses a
--      hand-rolled minimal interface only because types predate the table).
--   3. slack_alerts ............... migration 20260908100000 exists,
--      types/database.ts MISSING → add table block (slack-outbox.ts uses a
--      loose untyped facade only because types predate the table).
--   4. match_timeline_event_type ... migration 20260916000000 added 4 values
--      (relationship_ended, call_scheduled, group_joined, contribution),
--      types/database.ts enum STALE (4 values only) →
--      lib/relationships/history.ts already carries all 8 → align enum here.
--
-- Tables use IF NOT EXISTS so re-running is safe; service-role-only tables
-- (swipe_daily_quota, recommendation_scores pattern, slack_alerts) carry no
-- grants to anon/authenticated — matching their source migrations.
begin;

-- ─── 1. message_reactions (mirror 20260916010000) ──────────────────────────
create table if not exists public.message_reactions (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  constraint message_reactions_one_per_user unique (message_id, user_id)
);

create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id, created_at asc);

alter table public.message_reactions enable row level security;

drop policy if exists "Users can read reactions in their matches"
  on public.message_reactions;
create policy "Users can read reactions in their matches"
  on public.message_reactions for select
  using (
    exists (
      select 1
      from public.messages msg
      join public.matches m on m.id = msg.match_id
      where msg.id = message_reactions.message_id
        and (m.user1_id = auth.uid() or m.user2_id = auth.uid())
    )
  );

drop policy if exists "Users can react in their matches"
  on public.message_reactions;
create policy "Users can react in their matches"
  on public.message_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.messages msg
      join public.matches m on m.id = msg.match_id
      where msg.id = message_reactions.message_id
        and (m.user1_id = auth.uid() or m.user2_id = auth.uid())
    )
  );

drop policy if exists "Users can remove their own reactions"
  on public.message_reactions;
create policy "Users can remove their own reactions"
  on public.message_reactions for delete
  using (user_id = auth.uid());

grant select, insert, delete on public.message_reactions to authenticated;
grant all on public.message_reactions to service_role;

-- ─── 2. swipe_daily_quota (mirror 20260915000000, table only — the
-- ─── perform_swipe RPC body lives in its own migration) ────────────────────
create table if not exists public.swipe_daily_quota (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  quota_day  date not null,
  used_count smallint not null default 0 check (used_count between 0 and 10),
  primary key (user_id, quota_day),
  constraint swipe_daily_quota_no_negative check (used_count >= 0)
);

alter table public.swipe_daily_quota enable row level security;

-- Service-role / SECURITY DEFINER state only: no direct reads or writes from
-- anon/authenticated, exactly like recommendation_scores (HOST-DB-02 pattern).
revoke all on public.swipe_daily_quota from anon;
revoke all on public.swipe_daily_quota from authenticated;
grant all on public.swipe_daily_quota to service_role;

-- ─── 3. slack_alerts (mirror 20260908100000) ───────────────────────────────
create table if not exists public.slack_alerts (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text unique,
  text text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry_wait', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists slack_alerts_due_idx
  on public.slack_alerts (status, next_attempt_at);

-- Service-role only. Alerts are system-generated; no user-facing table.
alter table public.slack_alerts enable row level security;
revoke all on public.slack_alerts from anon;
revoke all on public.slack_alerts from authenticated;
grant all on public.slack_alerts to service_role;

-- ─── 4. match_timeline_event_type: align enum with 20260916000000 ──────────
-- ADD VALUE IF NOT EXISTS is idempotent; on PG12+ it may run inside a
-- migration transaction provided the new value is not used in the same
-- transaction (it is not).
alter type public.match_timeline_event_type
  add value if not exists 'relationship_ended';

alter type public.match_timeline_event_type
  add value if not exists 'call_scheduled';

alter type public.match_timeline_event_type
  add value if not exists 'group_joined';

alter type public.match_timeline_event_type
  add value if not exists 'contribution';

commit;
