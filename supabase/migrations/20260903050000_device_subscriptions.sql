-- S030: Device subscriptions for web push (conditional channel — enabled after security review)
create table public.device_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint device_subscriptions_user_endpoint_unique unique (user_id, endpoint)
);

create index device_subscriptions_user_idx
  on public.device_subscriptions (user_id) where is_active;

alter table public.device_subscriptions enable row level security;

create policy device_subscriptions_self_read
  on public.device_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy device_subscriptions_self_insert
  on public.device_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy device_subscriptions_self_update
  on public.device_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy device_subscriptions_self_delete
  on public.device_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.device_subscriptions to authenticated;
grant all on public.device_subscriptions to service_role;