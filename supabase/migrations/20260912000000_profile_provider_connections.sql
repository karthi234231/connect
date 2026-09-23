-- Session 07 (S07): LinkedIn provider connection + provider-owned profile data.
--
-- One row per user's provider linkage. sync_state is the persistence metadata
-- for the S07 sync transaction (src/services/linkedin/persistence.ts is the
-- sanctioned writer of sync_state / last_attempt_at / last_success_at /
-- failure_reason on the success + classified-failure paths). The provider-owned
-- profiles columns added below are the ONLY profile columns the provider
-- persistence path may touch (plus the pre-existing shared columns full_name /
-- avatar_url it refreshes) — user-owned fields (bio, skills, looking_for, ...)
-- are never written by the provider path (see field-ownership).
begin;

create table if not exists public.profile_provider_connections (
  user_id             uuid primary key references public.profiles (id) on delete cascade,
  provider            text not null default 'linkedin',
  provider_user_id    text,
  scopes              text[] not null default '{}',
  -- DB subset of the domain ProviderSyncState ('stale'/'unsupported' are
  -- derived read-side states, never persisted).
  sync_state          text not null default 'never_synced'
    check (sync_state in ('never_synced', 'syncing', 'synced', 'provider_revoked', 'retryable_error')),
  last_attempt_at     timestamptz,
  last_success_at     timestamptz,
  failure_reason      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Resolve a profile by provider identity.
create index if not exists profile_provider_connections_provider_user_idx
  on public.profile_provider_connections (provider, provider_user_id);

-- Provider-owned profile columns (nullable, absent until first sync).
alter table public.profiles
  add column if not exists provider_headline text,
  add column if not exists provider_location jsonb,
  add column if not exists provider_linked_in_identity jsonb;

comment on column public.profiles.provider_headline is
  'Provider headline (S07 provider-owned column — written only by the provider persistence path).';
comment on column public.profiles.provider_location is
  'Provider location snapshot (S07 provider-owned column — written only by the provider persistence path).';
comment on column public.profiles.provider_linked_in_identity is
  'Provider identity binding { provider, provider_user_id } (S07 provider-owned column).';

alter table public.profile_provider_connections enable row level security;

-- The app runs server-side as the authenticated user: owner-scoped policy covers
-- read + write (upsert) of the connection row.
create policy "Users manage their own provider connection"
  on public.profile_provider_connections
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger profile_provider_connections_touch_updated_at
  before update on public.profile_provider_connections
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.profile_provider_connections to authenticated;
grant all on public.profile_provider_connections to service_role;

commit;