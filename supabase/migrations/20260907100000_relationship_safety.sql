-- V10-BE-04 — durable, DB-enforced chat safety state.
--
-- 1. match_relationship_settings: per-user, per-match mute/archive state. A
--    single canonical `state` value is CHECK-constrained so only canonical
--    values can ever be written (app zod schema + DB CHECK agree). The
--    participant invariant is DB-enforced by trigger (Postgres forbids
--    subqueries inside CHECK constraints).
--
-- 2. reports.reported_match_id: optional, nullable conversation scoping for
--    `reportConversation`. `reported_id` stays the person being reported
--    (auth.users FK, unchanged RLS); the extra column lets a conversation
--    report dedupe against the same conversation and lets moderators triage.
--    Legacy rows remain valid (NULL).
begin;

create table if not exists public.match_relationship_settings (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  match_id   uuid not null references public.matches (id) on delete cascade,
  state      text not null default 'default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, match_id),
  constraint match_relationship_settings_state_canonical check (
    state in ('default', 'muted', 'archived', 'muted_archived')
  )
);

create trigger match_relationship_settings_touch_updated_at
  before update on public.match_relationship_settings
  for each row execute function public.touch_updated_at();

-- DB-enforced invariant: a user may only hold a setting on a match they
-- actually participate in — the last line of defense mirrors the service
-- layer authorization (resolve match row server-side).
create or replace function public.match_relationship_settings_participant_guard()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.matches m
    where m.id = new.match_id
      and (m.user1_id = new.user_id or m.user2_id = new.user_id)
  ) then
    raise exception 'relationship_settings_non_participant'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists match_relationship_settings_participant_guard
  on public.match_relationship_settings;
create trigger match_relationship_settings_participant_guard
  before insert or update on public.match_relationship_settings
  for each row execute function public.match_relationship_settings_participant_guard();

alter table public.match_relationship_settings enable row level security;

create policy "Users manage their own match relationship settings"
  on public.match_relationship_settings
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index match_relationship_settings_match_idx
  on public.match_relationship_settings (match_id);

-- Conversation-scoped reports (V10-BE-04 reportConversation).
alter table public.reports
  add column if not exists reported_match_id uuid
    references public.matches (id) on delete set null;

create index if not exists reports_reported_match_id_idx
  on public.reports (reported_match_id);

grant select, insert, update, delete on public.match_relationship_settings to authenticated;
grant select, insert, update, delete on public.match_relationship_settings to service_role;

commit;