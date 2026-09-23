-- V10-BE-01: user-scoped, idempotent dismissed relationship suggestions.
-- One row per (user, match); re-dismissing is a no-op (upsert on conflict).
begin;

create table if not exists public.relationship_suggestion_dismissals (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  match_id   uuid not null references public.matches (id) on delete cascade,
  source     text not null,
  created_at timestamptz not null default now(),
  constraint relationship_suggestion_dismissals_pair_unique
    unique (user_id, match_id, source),
  constraint relationship_suggestion_dismissals_source_check
    check (source in (
      'shared_interest', 'shared_skill', 'complementary_skill',
      'shared_event', 'shared_idea', 'same_city', 'conversation_gap'
    ))
);

alter table public.relationship_suggestion_dismissals enable row level security;

create policy "Users manage their own suggestion dismissals"
  on public.relationship_suggestion_dismissals
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index relationship_suggestion_dismissals_user_idx
  on public.relationship_suggestion_dismissals (user_id, match_id);

commit;
