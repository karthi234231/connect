-- Audit #88: moderation priority score. Higher value = more distinct
-- reporters have flagged the target, so it surfaces sooner in the queue.
alter table public.reports
  add column if not exists priority integer not null default 1;

comment on column public.reports.priority is
  'Moderation priority 1..10 (audit #88): accumulates with distinct reporters.';