-- CORE-06 MEDIUM — Ideas: versioning / edit history.
--
-- Every update to an idea snapshots the prior row into idea_revisions.
-- Revisions are owner-readable (idea owner sees the full history; others
-- see only the public idea itself). CASCADE from ideas.id so deleting an
-- idea purges its revisions. Includes in the GDPR verification list.
begin;

create table if not exists public.idea_revisions (
  id              uuid primary key default gen_random_uuid(),
  idea_id         uuid not null references public.ideas (id) on delete cascade,
  revision_number int not null,
  editor_id       uuid not null references public.profiles (id) on delete cascade,
  title           text not null,
  problem         text not null,
  solution        text not null,
  ask             text not null,
  stage           public.idea_stage not null,
  team_needed     text[] not null default '{}',
  tags            text[] not null default '{}',
  visibility      public.idea_visibility not null default 'published',
  join_enabled    boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint idea_revisions_unique unique (idea_id, revision_number)
);

create index if not exists idea_revisions_idea_id_created_idx
  on public.idea_revisions (idea_id, created_at desc);

create index if not exists idea_revisions_editor_id_idx
  on public.idea_revisions (editor_id);

alter table public.idea_revisions enable row level security;

-- Idea owner can read all revisions for their idea.
create policy "Idea owners can read all revisions"
  on public.idea_revisions for select
  using (
    exists (
      select 1 from public.ideas
      where ideas.id = idea_revisions.idea_id
        and ideas.owner_id = auth.uid()
    )
  );

-- Editors can insert their own revisions (the RPC/service is the writer).
create policy "Authors can insert their own revisions"
  on public.idea_revisions for insert
  with check (editor_id = auth.uid());

grant select, insert on public.idea_revisions to authenticated;
grant select, insert, update, delete on public.idea_revisions to service_role;

commit;
