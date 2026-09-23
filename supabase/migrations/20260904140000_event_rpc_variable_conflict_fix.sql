-- S02-TODO-B unit 5: fix plpgsql variable ambiguity in event RPCs.
-- RETURNS TABLE columns (user_id, event_id, status, ...) shadow table columns;
-- with default variable_conflict=error, the idempotency lookup (register) and
-- waitlist promotion select (cancel) raise 'column reference is ambiguous'.
-- Both bodies only use return query (never assign out-vars), so use_column is safe.
CREATE OR REPLACE FUNCTION public.register_event(p_event_id uuid, p_user_id uuid, p_request_id text DEFAULT NULL::text)
 RETURNS TABLE(registration_id uuid, event_id uuid, user_id uuid, status text, outcome text, waitlist_position integer, registered_count bigint, waitlisted_count bigint, capacity integer, remaining_capacity integer, spots_remaining integer, is_full boolean, promoted_registration_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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
$function$

;
CREATE OR REPLACE FUNCTION public.cancel_event_registration(p_registration_id uuid, p_user_id uuid)
 RETURNS TABLE(registration_id uuid, event_id uuid, user_id uuid, previous_status text, status text, promoted_registration_id uuid, promoted_user_id uuid, registered_count bigint, waitlisted_count bigint, capacity integer, remaining_capacity integer, spots_remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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
$function$

;
