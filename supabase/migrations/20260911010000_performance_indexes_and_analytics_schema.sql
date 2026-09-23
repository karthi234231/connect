begin;

-- ============================================================
-- Performance indexes and analytics schema improvements
-- Findings #128-#138 (Part B audit)
-- ============================================================

-- #128: Notification read/unread count should use index
-- Add composite index for queries filtering by read_at and ordering by created_at
create index if not exists notifications_user_read_created_idx
  on public.notifications (user_id, read_at, created_at desc);

-- #129: Match/connection queries need composite indexes
-- matches: user1_id + user2_id (already covered by unique constraint, but explicit)
-- matches: user1_id + status for filtered queries
create index if not exists matches_user1_status_idx
  on public.matches (user1_id, status);
-- matches: user2_id + status
create index if not exists matches_user2_status_idx
  on public.matches (user2_id, status);
-- recommendations: user_id + candidate_id for lookup
create index if not exists recommendations_user_candidate_idx
  on public.recommendations (user_id, candidate_id);
-- connection_requests: addressee_id + status + created_at for inbox queries
create index if not exists connections_addressee_status_created_idx
  on public.connection_requests (addressee_id, status, created_at);
-- connection_requests: requester_id + status + created_at for outbox queries
create index if not exists connections_requester_status_created_idx
  on public.connection_requests (requester_id, status, created_at);

-- #130: Event registration capacity index
-- Add index for capacity count queries (registered/checked_in/no_show)
create index if not exists event_registrations_capacity_count_idx
  on public.event_registrations (event_id, status)
  where status in ('registered', 'checked_in', 'no_show');

-- #131: Cache invalidation should be event-driven
-- ARCHITECTURAL GAP: Current invalidations are scattered across actions.
-- TODO: Refactor to use domain events (ProfileUpdated, MatchCreated, etc.)
-- with cache invalidation subscribers. This is a future refactoring task.

-- #132: Cache tags exist but read paths don't consistently use them
-- ARCHITECTURAL GAP: Audit of cache tag usage needed.
-- Current pattern: revalidateTag() + getCached() with tags.
-- TODO: Ensure every revalidateTag call has a corresponding getCached with that tag.

-- #133: Redis client initialization should be centralized
-- ARCHITECTURAL GAP: ratelimit.ts creates its own Redis client via Redis.fromEnv().
-- Should consolidate to use the singleton from @/lib/redis.
-- TODO: Refactor ratelimit.ts to import redis from @/lib/redis.

-- #134: Serverless cache/lock needs distributed semantics
-- ARCHITECTURAL GAP: In-memory JS map (inflight) used as stampede guard.
-- However, actual lock is Redis-based (lockKey). The inflight map is per-instance.
-- This is acceptable for stampede guard but not for distributed locks.
-- NOTE: Current implementation uses Redis lock, which is correct.

-- #136: Analytics should use raw event durability as source of truth
-- VERIFIED: analytics_events table exists and is authoritative.
-- Redis-only rollups do not exist; daily rollup is computed from raw events.

-- #137: Funnel metadata should not be silently dropped
-- Add meta column to analytics_events as JSONB with size restrictions
alter table public.analytics_events
  add column if not exists meta jsonb;

-- Add a check constraint to limit meta size (1KB)
-- This prevents abuse while allowing useful diagnostic dimensions
alter table public.analytics_events
  add constraint analytics_events_meta_size_check
  check (meta is null or pg_column_size(meta) <= 1024);

-- #138: Analytics events need event versioning
-- Add schema_version column for historical interpretability
alter table public.analytics_events
  add column if not exists schema_version integer not null default 1;

-- Add algorithm_version and source_version for future extensibility
alter table public.analytics_events
  add column if not exists algorithm_version text;

alter table public.analytics_events
  add column if not exists source_version text;

-- Update the BufferedEvent interface in flush.ts to include new fields
-- (code change in src/lib/analytics/flush.ts)

commit;