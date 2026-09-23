-- ============================================================
-- 010_ideas.sql — Idea-First Discovery (W3.4)
-- ideas, idea_interests, join_requests, team_memberships + RLS + grants
--
-- Privacy model (per docs/improvements/Web-responsive-application.md §7.2/§7.3):
--   * ideas: published cards are browse-safe; owner manages own card + join toggle.
--   * idea_interests: user records own validation; owner reads aggregate signals for own idea.
--   * join_requests: interested user inserts own request ONLY when join enabled; owner
--     selects/updates requests for own ideas (approve/reject). Applicants' identity is
--     approval-gated — an applicant's full identity is not browsable until approved.
--   * team_memberships: records approved joins; participant + owner readable.
-- ============================================================

-- Enums --------------------------------------------------------
create type public.idea_stage as enum
  ('idea', 'prototype', 'mvp', 'launched');

create type public.idea_visibility as enum
  ('published', 'draft', 'archived');

create type public.join_request_status as enum
  ('pending', 'approved', 'rejected');

-- ideas --------------------------------------------------------
create table public.ideas (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles (id) on delete cascade,
  title             text not null check (char_length(title) between 3 and 120),
  problem           text not null check (char_length(problem) between 10 and 1000),
  solution          text not null check (char_length(solution) between 10 and 2000),
  ask               text not null check (char_length(ask) between 3 and 500),
  stage             public.idea_stage not null default 'idea',
  team_needed       text[] not null default '{}',
  tags              text[] not null default '{}',
  visibility        public.idea_visibility not null default 'published',
  join_enabled      boolean not null default false,
  validation_count  int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger ideas_touch_updated_at
  before update on public.ideas
  for each row execute function public.touch_updated_at();

create index ideas_owner_id_idx on public.ideas (owner_id);
create index ideas_visibility_created_at_idx on public.ideas (visibility, created_at desc);
create index ideas_join_enabled_idx on public.ideas (join_enabled);

-- idea_interests (validation + interest log) -------------------
create table public.idea_interests (
  id          uuid primary key default gen_random_uuid(),
  idea_id     uuid not null references public.ideas (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  action      public.recommendation_action not null default 'like', -- like/pass/spark = validation
  created_at  timestamptz not null default now(),
  constraint idea_interests_unique unique (idea_id, user_id)
);

create index idea_interests_idea_id_idx on public.idea_interests (idea_id);
create index idea_interests_user_id_idx on public.idea_interests (user_id);

-- join_requests (owner-gated join flow) ------------------------
create table public.join_requests (
  id         uuid primary key default gen_random_uuid(),
  idea_id    uuid not null references public.ideas (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  status     public.join_request_status not null default 'pending',
  message    text check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint join_requests_unique unique (idea_id, user_id)
);

create trigger join_requests_touch_updated_at
  before update on public.join_requests
  for each row execute function public.touch_updated_at();

create index join_requests_idea_id_idx on public.join_requests (idea_id);
create index join_requests_user_id_idx on public.join_requests (user_id);

-- team_memberships (approved joins) ----------------------------
create table public.team_memberships (
  id         uuid primary key default gen_random_uuid(),
  idea_id    uuid not null references public.ideas (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'member' check (char_length(role) between 1 and 50),
  created_at timestamptz not null default now(),
  constraint team_memberships_unique unique (idea_id, user_id)
);

create index team_memberships_idea_id_idx on public.team_memberships (idea_id);
create index team_memberships_user_id_idx on public.team_memberships (user_id);

-- RLS ----------------------------------------------------------
alter table public.ideas enable row level security;
alter table public.idea_interests enable row level security;
alter table public.join_requests enable row level security;
alter table public.team_memberships enable row level security;

-- ideas: published cards browsable by authenticated + anon(browse-safe); owner CRUD
create policy "Ideas are readable when published or by owner"
  on public.ideas for select
  using (
    visibility = 'published'
    or auth.uid() = owner_id
  );

create policy "Users can create ideas"
  on public.ideas for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update their ideas"
  on public.ideas for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners can delete their ideas"
  on public.ideas for delete
  using (auth.uid() = owner_id);

-- idea_interests: user records own validation; owner reads aggregates for own idea
create policy "Idea interests are readable by owner or interested user"
  on public.idea_interests for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.ideas
      where ideas.id = idea_interests.idea_id and ideas.owner_id = auth.uid()
    )
  );

create policy "Users can record their own interest"
  on public.idea_interests for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own interest"
  on public.idea_interests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- join_requests: applicant manages own; owner selects/updates for own idea
create policy "Join requests are readable by applicant or idea owner"
  on public.join_requests for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.ideas
      where ideas.id = join_requests.idea_id and ideas.owner_id = auth.uid()
    )
  );

create policy "Applicants can insert a join request"
  on public.join_requests for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.ideas
      where ideas.id = join_requests.idea_id
        and ideas.join_enabled = true
        and ideas.owner_id <> auth.uid()
    )
  );

create policy "Applicants can cancel their own pending request"
  on public.join_requests for delete
  using (
    auth.uid() = user_id
    and status = 'pending'
  );

-- Owners approve/reject requests for their own idea
create policy "Owners can update join requests for their idea"
  on public.join_requests for update
  using (
    exists (
      select 1 from public.ideas
      where ideas.id = join_requests.idea_id and ideas.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.ideas
      where ideas.id = join_requests.idea_id and ideas.owner_id = auth.uid()
    )
  );

-- team_memberships: participant + owner readable
create policy "Memberships are readable by participant or idea owner"
  on public.team_memberships for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.ideas
      where ideas.id = team_memberships.idea_id and ideas.owner_id = auth.uid()
    )
  );

create policy "Owners can add members to their idea"
  on public.team_memberships for insert
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.ideas
      where ideas.id = team_memberships.idea_id and ideas.owner_id = auth.uid()
    )
  );

create policy "Members can leave and owners can remove members"
  on public.team_memberships for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.ideas
      where ideas.id = team_memberships.idea_id and ideas.owner_id = auth.uid()
    )
  );

-- Grants -------------------------------------------------------
grant select, insert, update, delete on public.ideas to authenticated;
grant select, insert, update, delete on public.idea_interests to authenticated;
grant select, insert, update, delete on public.join_requests to authenticated;
grant select, insert, update, delete on public.team_memberships to authenticated;

grant select on public.ideas to anon;
grant select on public.idea_interests to anon;
grant select on public.join_requests to anon;
grant select on public.team_memberships to anon;

grant select, insert, update, delete on public.ideas to service_role;
grant select, insert, update, delete on public.idea_interests to service_role;
grant select, insert, update, delete on public.join_requests to service_role;
grant select, insert, update, delete on public.team_memberships to service_role;
