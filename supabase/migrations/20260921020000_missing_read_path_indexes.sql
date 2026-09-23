-- DB-04 MEDIUM — Missing composite indexes for hot read paths.
--
-- EXPLAIN-justified indexes for query shapes that scan uncapped or use
-- single-column lookups in hot paths. Each is additive + guarded.
--
-- Sources:
--   1. profiles(last_active_at) — getDiscoverBatch applies an
--      activeWithinDays filter via public_profiles view → profiles lookup.
--      The existing profiles_discover_browse_ready_idx covers visibility +
--      browse-ready but NOT last_active_at. EXPLAIN on the discover pool query
--      shows a sequential scan when activeWithinDays is applied.
--   2. notification_deliveries(notification_id) — the outbox worker queries
--      deliveries by notification_id for status lookup; no dedicated index
--      means a sequential scan over pending rows on retry.
--   3. event_registration_idempotency(request_id) — the register_event RPC
--      looks up by request_id for deduplication; currently a scan.
begin;

-- 1. Discover last-active filter support
create index if not exists profiles_last_active_idx
  on public.profiles (last_active_at desc)
  where last_active_at is not null;

-- 2. Notification delivery lookup by notification
create index if not exists notification_deliveries_notification_idx
  on public.notification_deliveries (notification_id);

-- 3. Event registration idempotency lookup
create index if not exists event_registration_idempotency_request_idx
  on public.event_registration_idempotency (request_id);

commit;
