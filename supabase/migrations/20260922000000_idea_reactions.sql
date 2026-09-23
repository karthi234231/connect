begin;

-- Idea reactions — the idea detail page's ReactionBar contract.
-- W3.4 idea privacy model (Web plan §7.2/§7.3): published ideas are
-- browse-safe, so reactions on published ideas are readable by the same
-- audience; drafts stay owner-only via the #121 app-explicit visibility rule.
--
-- One reaction per (idea, user): the same emoji toggles off, a different emoji
-- replaces. The unique key IS the concurrency control (§210) — two racing
-- clients converge on a single row instead of double-counting a heart, and the
-- service treats a 23505 on insert as "someone already won, re-read".

create table if not exists public.idea_reactions (
  id         uuid primary key default gen_random_uuid(),
  idea_id    uuid not null references public.ideas (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  constraint idea_reactions_one_per_user unique (idea_id, user_id)
);

create index if not exists idea_reactions_idea_idx
  on public.idea_reactions (idea_id, created_at asc);

alter table public.idea_reactions enable row level security;

-- Select mirrors the ideas read audience: published cards are browse-safe and
-- the owner always reads their own reaction rows (even on drafts).
create policy "Reactions are readable when the idea is readable"
  on public.idea_reactions for select
  using (
    exists (
      select 1
      from public.ideas
      where ideas.id = idea_reactions.idea_id
        and (ideas.visibility = 'published' or auth.uid() = ideas.owner_id)
    )
  );

-- Insert is actor-scoped (blocks reacting as someone else) and requires the
-- parent idea to exist. Visibility is enforced app-side (#121) by the service
-- before any toggle reaches this layer.
create policy "Users can react to an idea"
  on public.idea_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.ideas
      where ideas.id = idea_reactions.idea_id
    )
  );

-- Delete is the toggle-off and the replace half of emoji-change, so a reaction
-- can only be removed by its owner. No UPDATE policy is granted: emoji changes
-- go through delete + insert, keeping "one row per (idea,user)" invariant
-- impossible to violate via a partial update.
create policy "Users can remove their own reactions"
  on public.idea_reactions for delete
  using (user_id = auth.uid());

-- Grants -------------------------------------------------------
grant select on public.idea_reactions to anon;
grant select, insert, delete on public.idea_reactions to authenticated;
grant all on public.idea_reactions to service_role;

commit;