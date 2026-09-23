-- ============================================================
-- Admin & Moderation completion (W5.3 / S7)
--
-- Adds `profiles.suspended_at` (used by AdminUserRowDTO + suspend/
-- unsuspend workflow) and an admin-only SELECT policy on `reports`
-- so the admin moderation surfaces can read the queue via RLS.
-- ============================================================

-- Suspension column on profiles ---------------------------------
alter table public.profiles
  add column if not exists suspended_at timestamptz;

create index if not exists profiles_suspended_at_idx
  on public.profiles (suspended_at);

-- Admin read on reports (admins review all reports) --------------
create policy "Admins can read all reports"
  on public.reports for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.app_role = 'admin'
    )
  );

-- Admin read on blocks (admins can inspect block lists) ----------
create policy "Admins can read all blocks"
  on public.blocks for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.app_role = 'admin'
    )
  );

-- Admin read on audit log (allow admin-only reads on audit_logs) --
-- (audit_logs RLS already restricts to admins; this is a no-op guard)
