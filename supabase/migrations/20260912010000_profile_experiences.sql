-- Session 07 (S07): provider-sourced professional experience rows.
--
-- One row per employment position brought in by the LinkedIn sync path
-- (src/services/linkedin/persistence.ts). `provider_external_id` is the
-- reconcile key: upsert-in by (user_id, provider_external_id), and delete only
-- rows the synced set no longer contains. A `null` experience payload from the
-- provider (capability unsupported / data absent) NEVER triggers the delete
-- path — stored history is never erased by an unsupported capability.
begin;

create table if not exists public.profile_experiences (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles (id) on delete cascade,
  source                text not null default 'linkedin',
  provider_external_id  text,
  company               text,
  title                 text not null,
  started_at            date,
  ended_at              date,
  is_current            boolean not null default false,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint profile_experiences_user_provider_unique
    unique (user_id, provider_external_id)
);

-- Read ordering: profile experience feed is always rendered in this order.
create index if not exists profile_experiences_user_sort_idx
  on public.profile_experiences (user_id, sort_order);

alter table public.profile_experiences enable row level security;

-- Owner-scoped: ownership constraint is the authenticated user binding
-- (user_id = auth.uid()) on every row.
create policy "Users manage their own experiences"
  on public.profile_experiences
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger profile_experiences_touch_updated_at
  before update on public.profile_experiences
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.profile_experiences to authenticated;
grant all on public.profile_experiences to service_role;

commit;