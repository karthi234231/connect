-- ============================================================
-- 001_init.sql — Connect DB Schema v0.1
-- Session 1.3. RLS enabled everywhere (policies land in 2.1).
-- ============================================================

-- Enums --------------------------------------------------------
create type public.role as enum
  ('founder','engineer','designer','product','growth','operations','data_ml','other');

create type public.commitment_level as enum
  ('exploring','nights_weekends','part_time','full_time');

create type public.work_style as enum
  ('structured','flexible','fast_iterate','deliberate');

create type public.profile_visibility as enum
  ('public','recruiting','private','stealth');

create type public.app_role as enum
  ('user','admin');

create type public.match_status as enum
  ('pending','active','declined');

create type public.match_timeline_event_type as enum
  ('match_created','match_accepted','first_reply','intro_requested');

create type public.recommendation_action as enum
  ('like','pass','spark');

-- Helper: bump updated_at ---------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles ------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null check (char_length(full_name) between 1 and 100),
  avatar_url        text,
  role              public.role,
  bio               text check (char_length(bio) <= 500),
  skills            text[] not null default '{}',
  availability      jsonb not null default '{"days":[],"hours":{"start":"09:00","end":"17:00"}}',
  timezone          text not null default 'UTC',
  looking_for       jsonb not null default '{"roles":[]}',
  commitment_level  public.commitment_level not null default 'exploring',
  work_style        public.work_style not null default 'flexible',
  visibility        public.profile_visibility not null default 'public',
  app_role          public.app_role not null default 'user',
  notification_prefs jsonb not null default '{"match_created":true,"intro_requested":true,"message_received":true,"event_reminder":true,"event_group_assigned":true}',
  last_active_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- user_skills ---------------------------------------------------
create table public.user_skills (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  skill       text not null,
  proficiency smallint not null check (proficiency between 1 and 5),
  primary key (user_id, skill)
);

create index user_skills_skill_idx on public.user_skills (skill);

-- matches -------------------------------------------------------
create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  user1_id    uuid not null references public.profiles (id) on delete cascade,
  user2_id    uuid not null references public.profiles (id) on delete cascade,
  status      public.match_status not null default 'pending',
  score       smallint check (score between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint matches_different_users check (user1_id <> user2_id),
  constraint matches_pair_unique unique (user1_id, user2_id)
);

create trigger matches_touch_updated_at
  before update on public.matches
  for each row execute function public.touch_updated_at();

create index matches_user2_idx on public.matches (user2_id);

-- messages ------------------------------------------------------
create table public.messages (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references public.matches (id) on delete cascade,
  sender_id         uuid not null references public.profiles (id) on delete cascade,
  content           text not null check (char_length(content) between 1 and 2000),
  attachment_url    text,
  client_message_id uuid not null unique,
  read_at           timestamptz,
  created_at        timestamptz not null default now()
);

create index messages_match_id_created_at_idx
  on public.messages (match_id, created_at desc);

-- match_timeline ------------------------------------------------
create table public.match_timeline (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  event_type public.match_timeline_event_type not null,
  meta       jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index match_timeline_match_id_created_at_idx
  on public.match_timeline (match_id, created_at asc);

-- recommendations (outcomes log) --------------------------------
create table public.recommendations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  score        smallint not null check (score between 0 and 100),
  action       public.recommendation_action not null,
  reasons      jsonb not null default '[]',
  breakdown    jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  constraint recommendations_no_self check (user_id <> candidate_id)
);

create index recommendations_user_id_created_at_idx
  on public.recommendations (user_id, created_at desc);

-- matching_weights (admin-editable, no code change) -------------
create table public.matching_weights (
  skill      numeric(5,2) not null default 25,
  intent     numeric(5,2) not null default 20,
  role       numeric(5,2) not null default 18,
  availability numeric(5,2) not null default 15,
  activity   numeric(5,2) not null default 12,
  timezone   numeric(5,2) not null default 10,
  diversity  numeric(5,2) not null default 0,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint matching_weights_sum_100 check (skill + intent + role + availability + activity + timezone + diversity = 100)
);

insert into public.matching_weights (skill, intent, role, availability, activity, timezone, diversity)
values (25, 20, 18, 15, 12, 10, 0);

-- feedback (dogfooding signal) ----------------------------------
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  context    text not null,
  message    text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index feedback_created_at_idx on public.feedback (created_at desc);

-- RLS: enable everywhere (policies: migration 002 in Session 2.1)
alter table public.profiles        enable row level security;
alter table public.user_skills     enable row level security;
alter table public.matches         enable row level security;
alter table public.messages        enable row level security;
alter table public.match_timeline  enable row level security;
alter table public.recommendations enable row level security;
alter table public.matching_weights enable row level security;
alter table public.feedback        enable row level security;