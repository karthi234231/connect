create type public.export_request_status as enum ('pending', 'fulfilled');

create table public.export_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  status     public.export_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

-- Enforce: only one pending request per user (partial unique index)
create unique index export_requests_one_pending_idx
  on public.export_requests (user_id)
  where status = 'pending';

create index export_requests_user_id_idx on public.export_requests (user_id);
create index export_requests_status_idx on public.export_requests (status);

alter table public.export_requests enable row level security;
create policy "Users can insert their own export request"
  on public.export_requests for insert with check (auth.uid() = user_id);
create policy "Users can read their own export requests"
  on public.export_requests for select using (auth.uid() = user_id);
create policy "Admins can read all export requests"
  on public.export_requests for select using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.app_role = 'admin')
  );

grant select, insert on public.export_requests to authenticated;
grant select, insert, update on public.export_requests to service_role;

-- avatars storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict do nothing;

create policy "Avatar uploads by owner"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Avatar read by owner"
  on storage.objects for select
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Avatar update by owner"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Avatar delete by owner"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
