-- Schema columns that were previously bundled with a seed migration.
alter table public.events add column if not exists cover_image text;
alter table public.events add column if not exists status text not null default 'published';
update public.events set status = 'published' where status is null;
alter table public.ideas add column if not exists image_url text;
