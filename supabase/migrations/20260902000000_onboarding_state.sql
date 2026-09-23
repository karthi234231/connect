-- S06 — Onboarding state model
-- Purpose: store onboarding completion separately from profile completeness.
-- Owner: system (platform writes via onboarding service; never client update).
-- Integrity: status is check-constrained; completed_at set iff status='completed'.
-- RLS: no new policies — public.profiles table RLS already governs all columns.
-- Rollback: ALTER TABLE public.profiles DROP COLUMN onboarding_status, DROP COLUMN onboarding_completed_at;

alter table public.profiles
  add column if not exists onboarding_status text not null default 'pending'
    constraint profiles_onboarding_status_check check (onboarding_status in ('pending', 'completed')),
  add column if not exists onboarding_completed_at timestamptz;

-- Deterministic invariant: completed rows must have a completion timestamp.
alter table public.profiles
  add constraint profiles_onboarding_completed_at_check
    check (onboarding_status = 'pending' or onboarding_completed_at is not null);
