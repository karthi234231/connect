begin;

-- ============================================================
-- S031 — Conversation-list read model: unread-aggregate index
-- Supports the grouped inbox unread query (one round trip) and the
-- read/flag path (matching S031 note: indexes on read/unread state).
-- Backed by the canonical messages table from 20260804204014_init.sql.
-- ============================================================

create index messages_unread_inbox_idx
  on public.messages (match_id)
  where read_at is null;

commit;