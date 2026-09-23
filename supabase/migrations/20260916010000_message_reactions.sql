begin;

-- P0-12 slice — message reactions.
-- Spec §13 (message model), §144.2 (conversation actions: React), §272.2
-- (message requirements), §210 (concurrency), §381 (security).
--
-- One reaction per (message, user): the same emoji toggles off, a different
-- emoji replaces. The unique key IS the concurrency control (§210) — two racing
-- clients converge on a single row instead of rendering duplicate pills, and the
-- service treats a 23505 on insert as "someone already won, re-read".

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

-- Participants of the parent match may read reactions in their threads.
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

-- Insert mirrors the messages policy: actor is the auth'd user AND belongs to
-- the parent thread. `user_id = auth.uid()` blocks reacting as someone else.
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

-- Delete is the toggle-off and the replace half of emoji-change, so a reaction
-- can only be removed by its owner. No UPDATE policy is granted: emoji changes
-- go through delete + insert, keeping "one row per (message,user)" invariant
-- impossible to violate via a partial update.
create policy "Users can remove their own reactions"
  on public.message_reactions for delete
  using (user_id = auth.uid());

commit;