-- 20260923000000_profiles_social_links.sql
-- The app (services/profiles/projection.ts) selects `social_links` on the
-- canonical projection, and the profile page renders it, but no migration
-- ever added the column. This fills the code-first gap (mirror of the
-- Session 03 `headline`/`idea` columns, which do exist).
begin;

alter table public.profiles
  add column if not exists social_links jsonb;

comment on column public.profiles.social_links is
  'User-owned social profile links (github/linkedin/twitter/portfolio).';

commit;