begin;

-- ============================================================
-- S019 — Canonical Events persistence contract
-- ============================================================

-- ------------------------------------------------------------
-- 1. Canonical organizer column
-- ------------------------------------------------------------

alter table public.events
  rename column host_id to organizer_id;

-- Existing seed rows are retained and become published
-- unless explicitly changed later.
alter table public.events
  add column if not exists status text not null default 'published'
    check (status in (
      'draft',
      'published',
      'cancelled',
      'sold_out',
      'completed'
    ));

alter table public.events
  add column visibility text not null default 'public'
    check (visibility in (
      'public',
      'private',
      'unlisted'
    ));

alter table public.events
  add column category text not null default 'other'
    check (category in (
      'technology',
      'business',
      'networking',
      'startup',
      'design',
      'career',
      'education',
      'wellness',
      'social',
      'arts',
      'sports',
      'outdoors',
      'community',
      'other'
    ));

alter table public.events
  add column venue jsonb;

alter table public.events
  add column timezone text not null default 'Asia/Kolkata';

alter table public.events
  add column price numeric(12,2) not null default 0;

alter table public.events
  add column currency text not null default 'INR';

alter table public.events
  add column published_at timestamptz;

alter table public.events
  add column registration_open boolean not null default true;

alter table public.events
  add column registration_deadline timestamptz;

alter table public.events
  add column if not exists cover_image text;

-- Align existing limits with the verified application schema.
alter table public.events
  drop constraint if exists events_title_check;

alter table public.events
  add constraint events_title_check
  check (char_length(title) between 3 and 100);

alter table public.events
  drop constraint if exists events_description_check;

alter table public.events
  add constraint events_description_check
  check (
    description is null
    or char_length(description) between 10 and 10000
  );

alter table public.events
  drop constraint if exists events_duration_minutes_check;

alter table public.events
  add constraint events_duration_minutes_check
  check (duration_minutes between 15 and 1440);

alter table public.events
  drop constraint if exists events_capacity_check;

alter table public.events
  add constraint events_capacity_check
  check (capacity between 1 and 10000);

alter table public.events
  add constraint events_price_check
  check (price >= 0);

alter table public.events
  add constraint events_currency_check
  check (char_length(currency) = 3);

alter table public.events
  add constraint events_registration_deadline_check
  check (
    registration_deadline is null
    or registration_deadline <= starts_at
  );

create index if not exists events_organizer_id_idx
  on public.events (organizer_id);

create index if not exists events_status_visibility_starts_at_idx
  on public.events (
    status,
    visibility,
    starts_at
  );

create index if not exists events_category_starts_at_idx
  on public.events (
    category,
    starts_at
  );

-- ------------------------------------------------------------
-- 2. Canonical event registrations
-- ------------------------------------------------------------

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),

  event_id uuid not null
    references public.events(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  status text not null default 'registered'
    check (status in (
      'registered',
      'waitlisted',
      'cancelled',
      'checked_in',
      'no_show'
    )),

  registered_at timestamptz not null default now(),

  cancelled_at timestamptz,

  waitlist_position integer,

  checked_in_at timestamptz,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint event_registrations_waitlist_position_check
    check (
      waitlist_position is null
      or waitlist_position > 0
    )
);

create unique index event_registrations_active_user_event_unique
  on public.event_registrations (
    event_id,
    user_id
  )
  where status in (
    'registered',
    'waitlisted',
    'checked_in',
    'no_show'
  );

create index event_registrations_event_status_idx
  on public.event_registrations (
    event_id,
    status
  );

create index event_registrations_event_waitlist_idx
  on public.event_registrations (
    event_id,
    waitlist_position
  )
  where status = 'waitlisted';

create index event_registrations_user_event_idx
  on public.event_registrations (
    user_id,
    event_id
  );

create index event_registrations_registered_at_idx
  on public.event_registrations (
    event_id,
    registered_at desc
  );

-- ------------------------------------------------------------
-- 3. Registration idempotency
-- ------------------------------------------------------------

create table public.event_registration_idempotency (
  id uuid primary key default gen_random_uuid(),

  request_id text not null,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  event_id uuid not null
    references public.events(id)
    on delete cascade,

  operation text not null
    check (operation in ('register', 'cancel')),

  registration_id uuid not null
    references public.event_registrations(id)
    on delete cascade,

  outcome text not null
    check (
      outcome in (
        'registered',
        'waitlisted',
        'already_registered',
        'already_waitlisted'
      )
    ),

  created_at timestamptz not null default now()
);

create unique index event_registration_idempotency_unique
  on public.event_registration_idempotency (
    request_id,
    user_id,
    event_id,
    operation
  );

create index event_registration_idempotency_registration_idx
  on public.event_registration_idempotency (
    registration_id
  );

-- ------------------------------------------------------------
-- 4. Event speakers
-- ------------------------------------------------------------

create table public.event_speakers (
  id uuid primary key default gen_random_uuid(),

  event_id uuid not null
    references public.events(id)
    on delete cascade,

  name text not null,

  role text,

  company text,

  avatar_url text,

  bio text,

  profile_url text,

  sort_order integer not null default 0
    check (sort_order >= 0),

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create index event_speakers_event_sort_idx
  on public.event_speakers (
    event_id,
    sort_order,
    id
  );

-- ------------------------------------------------------------
-- 5. Event agenda
-- ------------------------------------------------------------

create table public.event_agenda (
  id uuid primary key default gen_random_uuid(),

  event_id uuid not null
    references public.events(id)
    on delete cascade,

  title text not null,

  description text,

  starts_at timestamptz,

  ends_at timestamptz,

  duration_minutes integer
    check (
      duration_minutes is null
      or duration_minutes > 0
    ),

  speaker_ids jsonb not null default '[]'::jsonb,

  sort_order integer not null default 0
    check (sort_order >= 0),

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint event_agenda_time_order_check
    check (
      starts_at is null
      or ends_at is null
      or ends_at >= starts_at
    )
);

create index event_agenda_event_sort_idx
  on public.event_agenda (
    event_id,
    sort_order,
    starts_at,
    id
  );

-- ------------------------------------------------------------
-- 6. Event media
-- ------------------------------------------------------------

create table public.event_media (
  id uuid primary key default gen_random_uuid(),

  event_id uuid not null
    references public.events(id)
    on delete cascade,

  type text not null
    check (type in ('image', 'video')),

  url text not null,

  storage_path text,

  title text,

  description text,

  mime_type text,

  file_size bigint
    check (
      file_size is null
      or file_size >= 0
    ),

  duration_seconds numeric
    check (
      duration_seconds is null
      or duration_seconds >= 0
    ),

  thumbnail_url text,

  sort_order integer not null default 0
    check (sort_order >= 0),

  is_public boolean not null default true,

  allow_download boolean not null default true,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create index event_media_event_sort_idx
  on public.event_media (
    event_id,
    sort_order,
    created_at
  );

create index event_media_public_idx
  on public.event_media (
    event_id,
    is_public
  );

-- ------------------------------------------------------------
-- 7. updated_at trigger
-- ------------------------------------------------------------

create or replace function public.touch_event_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_touch_updated_at
  on public.events;

create trigger events_touch_updated_at
before update on public.events
for each row
execute function public.touch_event_updated_at();

drop trigger if exists event_registrations_touch_updated_at
  on public.event_registrations;

create trigger event_registrations_touch_updated_at
before update on public.event_registrations
for each row
execute function public.touch_event_updated_at();

drop trigger if exists event_speakers_touch_updated_at
  on public.event_speakers;

create trigger event_speakers_touch_updated_at
before update on public.event_speakers
for each row
execute function public.touch_event_updated_at();

drop trigger if exists event_agenda_touch_updated_at
  on public.event_agenda;

create trigger event_agenda_touch_updated_at
before update on public.event_agenda
for each row
execute function public.touch_event_updated_at();

drop trigger if exists event_media_touch_updated_at
  on public.event_media;

create trigger event_media_touch_updated_at
before update on public.event_media
for each row
execute function public.touch_event_updated_at();

-- ------------------------------------------------------------
-- 8. Backfill canonical registrations from legacy attendees
-- ------------------------------------------------------------

insert into public.event_registrations (
  event_id,
  user_id,
  status,
  registered_at,
  created_at,
  updated_at
)
select
  ea.event_id,
  ea.user_id,
  case
    when ea.status = 'waitlisted' then 'waitlisted'
    when ea.status = 'cancelled' then 'cancelled'
    else 'registered'
  end,
  ea.created_at,
  ea.created_at,
  now()
from public.event_attendees ea
where not exists (
  select 1
  from public.event_registrations er
  where er.event_id = ea.event_id
    and er.user_id = ea.user_id
);

-- ------------------------------------------------------------
-- 9. Canonical registration capacity
-- ------------------------------------------------------------

create or replace function public.get_event_registration_capacity(
  p_event_id uuid
)
returns table (
  capacity integer,
  registered_count bigint,
  waitlisted_count bigint,
  available_seats integer,
  is_full boolean,
  is_waitlist_open boolean,
  registration_open boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_status text;
  v_registration_open boolean;
  v_registered_count bigint;
  v_waitlisted_count bigint;
  v_available_seats integer;
begin
  select
    e.capacity,
    e.status,
    e.registration_open
  into
    v_capacity,
    v_status,
    v_registration_open
  from public.events e
  where e.id = p_event_id;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  if v_status <> 'published' then
    v_registration_open := false;
  end if;

  select count(*)
  into v_registered_count
  from public.event_registrations er
  where er.event_id = p_event_id
    and er.status in (
      'registered',
      'checked_in',
      'no_show'
    );

  select count(*)
  into v_waitlisted_count
  from public.event_registrations er
  where er.event_id = p_event_id
    and er.status = 'waitlisted';

  v_available_seats :=
    case
      when v_capacity is null then null
      else greatest(
        v_capacity - v_registered_count::integer,
        0
      )
    end;

  return query
  select
    v_capacity,
    v_registered_count,
    v_waitlisted_count,
    v_available_seats,
    (
      v_capacity is not null
      and v_registered_count >= v_capacity
    ),
    (
      v_capacity is not null
      and v_registered_count >= v_capacity
      and v_registration_open
    ),
    v_registration_open;
end;
$$;

-- ------------------------------------------------------------
-- 10. Canonical register RPC
-- ------------------------------------------------------------

create or replace function public.register_event(
  p_event_id uuid,
  p_user_id uuid,
  p_request_id text default null
)
returns table (
  registration_id uuid,
  event_id uuid,
  user_id uuid,
  status text,
  outcome text,
  waitlist_position integer,
  registered_count bigint,
  waitlisted_count bigint,
  capacity integer,
  remaining_capacity integer,
  spots_remaining integer,
  is_full boolean,
  promoted_registration_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_existing public.event_registrations%rowtype;
  v_registration public.event_registrations%rowtype;
  v_existing_idempotency public.event_registration_idempotency%rowtype;
  v_registered_count bigint;
  v_waitlisted_count bigint;
  v_status text;
  v_outcome text;
  v_waitlist_position integer;
  v_remaining integer;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if auth.uid() <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  select *
  into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  if p_request_id is not null then
    select *
    into v_existing_idempotency
    from public.event_registration_idempotency
    where request_id = p_request_id
      and user_id = p_user_id
      and event_id = p_event_id
      and operation = 'register'
    limit 1;

    if found then
      select *
      into v_registration
      from public.event_registrations
      where id = v_existing_idempotency.registration_id;

      if not found then
        raise exception 'IDEMPOTENCY_CONFLICT';
      end if;

      select count(*)
      into v_registered_count
      from public.event_registrations
      where event_id = p_event_id
        and status in (
          'registered',
          'checked_in',
          'no_show'
        );

      select count(*)
      into v_waitlisted_count
      from public.event_registrations
      where event_id = p_event_id
        and status = 'waitlisted';

      v_remaining :=
        case
          when v_event.capacity is null then null
          else greatest(
            v_event.capacity - v_registered_count::integer,
            0
          )
        end;

      return query
      select
        v_registration.id,
        v_registration.event_id,
        v_registration.user_id,
        v_registration.status,
        v_existing_idempotency.outcome,
        v_registration.waitlist_position,
        v_registered_count,
        v_waitlisted_count,
        v_event.capacity,
        v_remaining,
        v_remaining,
        (
          v_event.capacity is not null
          and v_registered_count >= v_event.capacity
        ),
        null::uuid;

      return;
    end if;
  end if;

  if v_event.status <> 'published'
     or not v_event.registration_open
     or (
       v_event.registration_deadline is not null
       and v_event.registration_deadline <= now()
     ) then
    raise exception 'REGISTRATION_CLOSED';
  end if;

  select *
  into v_existing
  from public.event_registrations
  where event_id = p_event_id
    and user_id = p_user_id
    and status in (
      'registered',
      'waitlisted',
      'checked_in',
      'no_show'
    )
  limit 1;

  if found then
    v_outcome :=
      case
        when v_existing.status = 'waitlisted'
          then 'already_waitlisted'
        else 'already_registered'
      end;

    if p_request_id is not null then
      insert into public.event_registration_idempotency (
        request_id,
        user_id,
        event_id,
        operation,
        registration_id,
        outcome
      )
      values (
        p_request_id,
        p_user_id,
        p_event_id,
        'register',
        v_existing.id,
        v_outcome
      )
      on conflict (
        request_id,
        user_id,
        event_id,
        operation
      ) do nothing;
    end if;

    select count(*)
    into v_registered_count
    from public.event_registrations
    where event_id = p_event_id
      and status in (
        'registered',
        'checked_in',
        'no_show'
      );

    select count(*)
    into v_waitlisted_count
    from public.event_registrations
    where event_id = p_event_id
      and status = 'waitlisted';

    v_remaining :=
      case
        when v_event.capacity is null then null
        else greatest(
          v_event.capacity - v_registered_count::integer,
          0
        )
      end;

    return query
    select
      v_existing.id,
      v_existing.event_id,
      v_existing.user_id,
      v_existing.status,
      v_outcome,
      v_existing.waitlist_position,
      v_registered_count,
      v_waitlisted_count,
      v_event.capacity,
      v_remaining,
      v_remaining,
      (
        v_event.capacity is not null
        and v_registered_count >= v_event.capacity
      ),
      null::uuid;

    return;
  end if;

  select count(*)
  into v_registered_count
  from public.event_registrations
  where event_id = p_event_id
    and status in (
      'registered',
      'checked_in',
      'no_show'
    );

  select count(*)
  into v_waitlisted_count
  from public.event_registrations
  where event_id = p_event_id
    and status = 'waitlisted';

  if v_event.capacity is null
     or v_registered_count < v_event.capacity then

    v_status := 'registered';
    v_outcome := 'registered';
    v_waitlist_position := null;

  else
    v_status := 'waitlisted';
    v_outcome := 'waitlisted';
    v_waitlist_position :=
      v_waitlisted_count::integer + 1;
  end if;

  insert into public.event_registrations (
    event_id,
    user_id,
    status,
    registered_at
  )
  values (
    p_event_id,
    p_user_id,
    v_status,
    now()
  )
  returning *
  into v_registration;

  if p_request_id is not null then
    insert into public.event_registration_idempotency (
      request_id,
      user_id,
      event_id,
      operation,
      registration_id,
      outcome
    )
    values (
      p_request_id,
      p_user_id,
      p_event_id,
      'register',
      v_registration.id,
      v_outcome
    );
  end if;

  select count(*)
  into v_registered_count
  from public.event_registrations
  where event_id = p_event_id
    and status in (
      'registered',
      'checked_in',
      'no_show'
    );

  select count(*)
  into v_waitlisted_count
  from public.event_registrations
  where event_id = p_event_id
    and status = 'waitlisted';

  v_remaining :=
    case
      when v_event.capacity is null then null
      else greatest(
        v_event.capacity - v_registered_count::integer,
        0
      )
    end;

  return query
  select
    v_registration.id,
    v_registration.event_id,
    v_registration.user_id,
    v_registration.status,
    v_outcome,
    v_registration.waitlist_position,
    v_registered_count,
    v_waitlisted_count,
    v_event.capacity,
    v_remaining,
    v_remaining,
    (
      v_event.capacity is not null
      and v_registered_count >= v_event.capacity
    ),
    null::uuid;
end;
$$;

revoke all on function public.register_event(
  uuid,
  uuid,
  text
) from public;

grant execute on function public.register_event(
  uuid,
  uuid,
  text
) to authenticated;

-- ------------------------------------------------------------
-- 11. Canonical cancellation RPC + promotion
-- ------------------------------------------------------------

create or replace function public.cancel_event_registration(
  p_registration_id uuid,
  p_user_id uuid
)
returns table (
  registration_id uuid,
  event_id uuid,
  user_id uuid,
  previous_status text,
  status text,
  promoted_registration_id uuid,
  promoted_user_id uuid,
  registered_count bigint,
  waitlisted_count bigint,
  capacity integer,
  remaining_capacity integer,
  spots_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.event_registrations%rowtype;
  v_event public.events%rowtype;
  v_next public.event_registrations%rowtype;
  v_registered_count bigint;
  v_waitlisted_count bigint;
  v_remaining integer;
  v_promoted_id uuid;
  v_promoted_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if auth.uid() <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  select *
  into v_registration
  from public.event_registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception 'REGISTRATION_NOT_FOUND';
  end if;

  if v_registration.user_id <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  if v_registration.status not in (
    'registered',
    'waitlisted'
  ) then
    raise exception 'REGISTRATION_NOT_ACTIVE';
  end if;

  select *
  into v_event
  from public.events
  where id = v_registration.event_id
  for update;

  update public.event_registrations
  set
    status = 'cancelled',
    cancelled_at = now(),
    waitlist_position = null,
    updated_at = now()
  where id = p_registration_id;

  if v_registration.status = 'registered' then

    select *
    into v_next
    from public.event_registrations
    where event_id = v_registration.event_id
      and status = 'waitlisted'
    order by
      waitlist_position asc,
      registered_at asc,
      id asc
    limit 1
    for update skip locked;

    if found then
      update public.event_registrations
      set
        status = 'registered',
        registered_at = now(),
        waitlist_position = null,
        cancelled_at = null,
        updated_at = now()
      where id = v_next.id
      returning id, user_id
      into v_promoted_id, v_promoted_user_id;
    end if;
  end if;

  select count(*)
  into v_registered_count
  from public.event_registrations
  where event_id = v_registration.event_id
    and status in (
      'registered',
      'checked_in',
      'no_show'
    );

  select count(*)
  into v_waitlisted_count
  from public.event_registrations
  where event_id = v_registration.event_id
    and status = 'waitlisted';

  v_remaining :=
    case
      when v_event.capacity is null then null
      else greatest(
        v_event.capacity - v_registered_count::integer,
        0
      )
    end;

  return query
  select
    v_registration.id,
    v_registration.event_id,
    v_registration.user_id,
    v_registration.status,
    'cancelled'::text,
    v_promoted_id,
    v_promoted_user_id,
    v_registered_count,
    v_waitlisted_count,
    v_event.capacity,
    v_remaining,
    v_remaining;
end;
$$;

revoke all on function public.cancel_event_registration(
  uuid,
  uuid
) from public;

grant execute on function public.cancel_event_registration(
  uuid,
  uuid
) to authenticated;

-- ------------------------------------------------------------
-- 12. RLS — events
-- ------------------------------------------------------------

drop policy if exists "Events are readable by all authenticated"
  on public.events;

drop policy if exists "Hosts can create events"
  on public.events;

drop policy if exists "Hosts can update their own events"
  on public.events;

drop policy if exists "Hosts can delete their own events"
  on public.events;

create policy events_authenticated_read
on public.events
for select
to authenticated
using (
  status <> 'draft'
  or organizer_id = auth.uid()
);

create policy events_organizer_insert
on public.events
for insert
to authenticated
with check (
  organizer_id = auth.uid()
);

create policy events_organizer_update
on public.events
for update
to authenticated
using (
  organizer_id = auth.uid()
)
with check (
  organizer_id = auth.uid()
);

create policy events_organizer_delete
on public.events
for delete
to authenticated
using (
  organizer_id = auth.uid()
);

-- ------------------------------------------------------------
-- 13. RLS — event groups
-- ------------------------------------------------------------

drop policy if exists "Groups are readable by all authenticated"
  on public.event_groups;

drop policy if exists "Hosts can create groups"
  on public.event_groups;

drop policy if exists "Hosts can update groups"
  on public.event_groups;

drop policy if exists "Hosts can delete groups"
  on public.event_groups;

create policy event_groups_authenticated_read
on public.event_groups
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_groups.event_id
      and (
        e.status <> 'draft'
        or e.organizer_id = auth.uid()
      )
  )
);

create policy event_groups_organizer_insert
on public.event_groups
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_groups.event_id
      and e.organizer_id = auth.uid()
  )
);

create policy event_groups_organizer_update
on public.event_groups
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_groups.event_id
      and e.organizer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_groups.event_id
      and e.organizer_id = auth.uid()
  )
);

create policy event_groups_organizer_delete
on public.event_groups
for delete
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_groups.event_id
      and e.organizer_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- 14. RLS — legacy event attendees retained for compatibility
-- ------------------------------------------------------------

-- Existing attendee policies remain valid for legacy consumers.
-- No destructive removal occurs in S019.

-- ------------------------------------------------------------
-- 15. RLS — canonical registrations
-- ------------------------------------------------------------

alter table public.event_registrations
enable row level security;

create policy event_registrations_self_read
on public.event_registrations
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.events e
    where e.id = event_registrations.event_id
      and e.organizer_id = auth.uid()
  )
);

create policy event_registrations_self_insert
on public.event_registrations
for insert
to authenticated
with check (
  user_id = auth.uid()
);

create policy event_registrations_self_update
on public.event_registrations
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.events e
    where e.id = event_registrations.event_id
      and e.organizer_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.events e
    where e.id = event_registrations.event_id
      and e.organizer_id = auth.uid()
  )
);

create policy event_registrations_self_delete
on public.event_registrations
for delete
to authenticated
using (
  user_id = auth.uid()
);

-- ------------------------------------------------------------
-- 16. RLS — idempotency
-- ------------------------------------------------------------

alter table public.event_registration_idempotency
enable row level security;

create policy event_registration_idempotency_self_read
on public.event_registration_idempotency
for select
to authenticated
using (
  user_id = auth.uid()
);

create policy event_registration_idempotency_service_write
on public.event_registration_idempotency
for insert
to authenticated
with check (
  user_id = auth.uid()
);

-- ------------------------------------------------------------
-- 17. RLS — speakers
-- ------------------------------------------------------------

alter table public.event_speakers
enable row level security;

create policy event_speakers_read
on public.event_speakers
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_speakers.event_id
      and (
        e.status <> 'draft'
        or e.organizer_id = auth.uid()
      )
  )
);

create policy event_speakers_organizer_insert
on public.event_speakers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_speakers.event_id
      and e.organizer_id = auth.uid()
  )
);

create policy event_speakers_organizer_update
on public.event_speakers
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_speakers.event_id
      and e.organizer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_speakers.event_id
      and e.organizer_id = auth.uid()
  )
);

create policy event_speakers_organizer_delete
on public.event_speakers
for delete
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_speakers.event_id
      and e.organizer_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- 18. RLS — agenda
-- ------------------------------------------------------------

alter table public.event_agenda
enable row level security;

create policy event_agenda_read
on public.event_agenda
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_agenda.event_id
      and (
        e.status <> 'draft'
        or e.organizer_id = auth.uid()
      )
  )
);

create policy event_agenda_organizer_insert
on public.event_agenda
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_agenda.event_id
      and e.organizer_id = auth.uid()
  )
);

create policy event_agenda_organizer_update
on public.event_agenda
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_agenda.event_id
      and e.organizer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_agenda.event_id
      and e.organizer_id = auth.uid()
  )
);

create policy event_agenda_organizer_delete
on public.event_agenda
for delete
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_agenda.event_id
      and e.organizer_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- 19. RLS — media
-- ------------------------------------------------------------

alter table public.event_media
enable row level security;

create policy event_media_read
on public.event_media
for select
to authenticated
using (
  (
    is_public = true
    and exists (
      select 1
      from public.events e
      where e.id = event_media.event_id
        and e.status <> 'draft'
    )
  )
  or exists (
    select 1
    from public.events e
    where e.id = event_media.event_id
      and e.organizer_id = auth.uid()
  )
);

create policy event_media_organizer_insert
on public.event_media
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_media.event_id
      and e.organizer_id = auth.uid()
  )
);

create policy event_media_organizer_update
on public.event_media
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_media.event_id
      and e.organizer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_media.event_id
      and e.organizer_id = auth.uid()
  )
);

create policy event_media_organizer_delete
on public.event_media
for delete
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_media.event_id
      and e.organizer_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- 20. Grants
-- ------------------------------------------------------------

grant select, insert, update, delete
on public.events
to authenticated;

grant select, insert, update, delete
on public.event_groups
to authenticated;

grant select, insert, update, delete
on public.event_attendees
to authenticated;

grant select, insert, update, delete
on public.event_registrations
to authenticated;

grant select, insert
on public.event_registration_idempotency
to authenticated;

grant select, insert, update, delete
on public.event_speakers
to authenticated;

grant select, insert, update, delete
on public.event_agenda
to authenticated;

grant select, insert, update, delete
on public.event_media
to authenticated;

grant all
on public.events
to service_role;

grant all
on public.event_groups
to service_role;

grant all
on public.event_attendees
to service_role;

grant all
on public.event_registrations
to service_role;

grant all
on public.event_registration_idempotency
to service_role;

grant all
on public.event_speakers
to service_role;

grant all
on public.event_agenda
to service_role;

grant all
on public.event_media
to service_role;

commit;