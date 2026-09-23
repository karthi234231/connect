-- Audit #70: DB row and storage object must follow an explicit upload
-- lifecycle so orphan objects / broken DB references are detectable and
-- repairable:
--   pending   -> row created, object upload in flight (not yet validated)
--   published -> object verified, media is live
--   deleting  -> object removal scheduled/in progress; row removed after
-- Reconciliation (see EventMediaRepository.reconcileStale) repairs rows stuck
-- in pending/deleting.
alter table public.event_media
  add column if not exists lifecycle_status text not null default 'published';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'event_media_lifecycle_check'
  ) then
    alter table public.event_media
      add constraint event_media_lifecycle_check
      check (lifecycle_status in ('pending', 'published', 'deleting'));
  end if;
end $$;

create index if not exists event_media_lifecycle_idx
  on public.event_media (lifecycle_status, created_at);

comment on column public.event_media.lifecycle_status is
  'Upload lifecycle: pending -> published, or deleting before row removal (#70).';