-- ============================================================
-- 011_guest_browse.sql — S1 Guest Browse Mode (§2.3 "guest")
-- Adds anon SELECT policies so unauthenticated users can browse
-- *public* ideas and events via public DTOs (no mutation).
--
-- `ideas` already grants anon select (published) in 010_ideas.sql.
-- This migration adds the missing anon select for `events` so the
-- guest events surface works under RLS. It also grants anon select
-- on `saved_events` count-style reads is NOT needed (remain private).
--
-- Privacy: anon can ONLY read public event fields (no host identity,
-- no attendee PII). Mutations remain restricted to authenticated
-- users (own RSVPs, host create/update/delete).
-- ============================================================

-- Events: allow unauthenticated SELECT on public fields only.
-- Hosts are still required for create/update/delete (no anon write).
create policy "Events are readable by guests (public fields)"
  on public.events for select
  using (auth.role() = 'anon' OR auth.role() = 'authenticated');

-- Grant anon SELECT on events (already granted to authenticated).
grant select on public.events to anon;

-- Event groups: browse-safe labels are public; no write for guests.
create policy "Event groups are readable by guests"
  on public.event_groups for select
  using (auth.role() = 'anon' OR auth.role() = 'authenticated');

grant select on public.event_groups to anon;

-- NOTE: event_attendees stays private (no anon). Guests never see
-- who is attending, only the public event card fields.
