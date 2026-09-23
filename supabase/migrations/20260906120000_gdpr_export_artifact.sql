begin;

-- ============================================================
-- Session 18 — GDPR export artifact (#16): exports must be
-- retrievable, not generated-then-discarded.
-- Metadata lives on export_requests (avoids a second job table
-- + RLS surface; users already SELECT their own rows).
-- Artifact bytes live in a PRIVATE storage bucket; downloads go
-- through the admin signed-URL route only (no client storage access).
-- ============================================================

alter table public.export_requests
  add column if not exists object_key text,
  add column if not exists checksum  text,
  add column if not exists size_bytes bigint,
  add column if not exists expires_at timestamptz;

-- Private bucket for export artifacts ({user_id}/{request_id}.json).
insert into storage.buckets (id, name, public)
values ('gdpr-exports', 'gdpr-exports', false)
on conflict (id) do nothing;

commit;