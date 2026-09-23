begin;

alter table public.audit_logs
  rename column actor to actor_id;

alter table public.audit_logs
  rename column table_name to entity_type;

alter table public.audit_logs
  rename column row_id to entity_id;

alter table public.audit_logs
  rename column meta to metadata;

alter table public.audit_logs
  alter column actor_id drop not null;

alter table public.audit_logs
  add constraint audit_logs_actor_id_fkey
  foreign key (actor_id)
  references auth.users(id)
  on delete set null;

create index if not exists audit_logs_actor_created_at_idx
  on public.audit_logs (actor_id, created_at desc);

create index if not exists audit_logs_entity_created_at_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

create index if not exists audit_logs_action_created_at_idx
  on public.audit_logs (action, created_at desc);

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_id uuid;
begin
  v_row_id :=
    case
      when tg_op = 'DELETE' then old.id
      else new.id
    end;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_row_id,
    jsonb_build_object(
      'source', 'database_trigger'
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

commit;