-- ============================================================
-- 009_events.sql — Community Events (Session 3.7 real implementation)
-- events, event_attendees, event_groups + RLS + grants
-- ============================================================

-- Enums --------------------------------------------------------
create type public.event_type as enum ('virtual', 'irl');
create type public.event_format as enum ('build_night', 'coffee', 'challenge', 'office_hours', 'workshop', 'social');
create type public.event_recurrence as enum ('none', 'weekly', 'biweekly', 'monthly');
create type public.event_attendee_status as enum ('going', 'waitlisted', 'cancelled');

-- events -------------------------------------------------------
create table public.events (
  id                uuid primary key default gen_random_uuid(),
  host_id           uuid not null references public.profiles (id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 100),
  description       text check (char_length(description) <= 1000),
  type              public.event_type not null default 'virtual',
  format            public.event_format not null default 'build_night',
  location_or_link  text not null default '',
  starts_at         timestamptz not null,
  duration_minutes  int not null default 60 check (duration_minutes between 15 and 480),
  capacity          int not null default 10 check (capacity > 0),
  tags              jsonb not null default '[]',
  recurrence        public.event_recurrence not null default 'none',
  recurrence_end    timestamptz,
  parent_event_id   uuid references public.events (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.touch_updated_at();

create index events_starts_at_idx on public.events (starts_at);
create index events_parent_event_id_idx on public.events (parent_event_id);
create index events_host_id_idx on public.events (host_id);

-- event_groups (host-defined breakout groups) ------------------
create table public.event_groups (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 100),
  capacity   int check (capacity > 0),
  created_at timestamptz not null default now()
);

create index event_groups_event_id_idx on public.event_groups (event_id);

-- event_attendees ----------------------------------------------
create table public.event_attendees (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  status     public.event_attendee_status not null default 'going',
  group_id   uuid references public.event_groups (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_attendees_event_id_idx on public.event_attendees (event_id);
create index event_attendees_user_id_idx on public.event_attendees (user_id);
create index event_attendees_group_id_idx on public.event_attendees (group_id);

-- RLS ----------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_groups enable row level security;
alter table public.event_attendees enable row level security;

-- events: readable by all authenticated; host manages own
create policy "Events are readable by all authenticated"
  on public.events for select
  using (auth.role() = 'authenticated');

create policy "Hosts can create events"
  on public.events for insert
  with check (auth.uid() = host_id);

create policy "Hosts can update their own events"
  on public.events for update
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

create policy "Hosts can delete their own events"
  on public.events for delete
  using (auth.uid() = host_id);

-- event_groups: host-managed, attendee-readable
create policy "Groups are readable by all authenticated"
  on public.event_groups for select
  using (auth.role() = 'authenticated');

create policy "Hosts can create groups"
  on public.event_groups for insert
  with check (
    exists (select 1 from public.events where events.id = event_id and events.host_id = auth.uid())
  );

create policy "Hosts can update groups"
  on public.event_groups for update
  using (
    exists (select 1 from public.events where events.id = event_id and events.host_id = auth.uid())
  );

create policy "Hosts can delete groups"
  on public.event_groups for delete
  using (
    exists (select 1 from public.events where events.id = event_id and events.host_id = auth.uid())
  );

-- event_attendees: user manages own row; host reads/assigns all
create policy "Attendees are readable by all authenticated"
  on public.event_attendees for select
  using (auth.role() = 'authenticated');

create policy "Users can RSVP themselves"
  on public.event_attendees for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own RSVP"
  on public.event_attendees for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can cancel their own RSVP"
  on public.event_attendees for delete
  using (auth.uid() = user_id);

-- Hosts can assign attendees to groups
create policy "Hosts can assign attendees to groups"
  on public.event_attendees for update
  using (
    exists (select 1 from public.events where events.id = event_id and events.host_id = auth.uid())
  )
  with check (
    exists (select 1 from public.events where events.id = event_id and events.host_id = auth.uid())
  );

-- Grants -------------------------------------------------------
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.event_groups to authenticated;
grant select, insert, update, delete on public.event_attendees to authenticated;
grant select, insert, update, delete on public.events to service_role;
grant select, insert, update, delete on public.event_groups to service_role;
grant select, insert, update, delete on public.event_attendees to service_role;