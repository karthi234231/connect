-- DB-03 MEDIUM — RLS policy coverage for every user-scoped table.
--
-- Every table that stores per-user data (identified by user_id, owner_id,
-- requester_id, addressee_id, blocker_id/blocked_id, reporter_id/reported_id,
-- host_id, sender_id, actor_id, updated_by, or organizer_id columns) must have
-- RLS enabled. This probe discovers such tables dynamically and reports any
-- without row-level security.
--
-- Acceptance: zero rows returned (all user-scoped tables have RLS enabled).
WITH user_scoped_tables AS (
  SELECT
    c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND a.attname IN (
      'user_id', 'owner_id', 'requester_id', 'addressee_id',
      'blocker_id', 'blocked_id', 'reporter_id', 'reported_id',
      'host_id', 'sender_id', 'actor_id', 'updated_by',
      'organizer_id', 'candidate_id'
    )
    AND a.atttypid = 'uuid'::regtype
),
rls_status AS (
  SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname = 'public'
)
SELECT
  u.table_name,
  COALESCE(r.rls_enabled, FALSE) AS rls_enabled,
  COALESCE(p.policy_count, 0) AS policy_count
FROM user_scoped_tables u
LEFT JOIN rls_status r ON r.table_name = u.table_name
LEFT JOIN (
  SELECT
    pol.tblid::regclass::text AS table_name,
    COUNT(*) AS policy_count
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.tblid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
  GROUP BY pol.tblid
) p ON p.table_name = format('public.%s', u.table_name)
WHERE COALESCE(r.rls_enabled, FALSE) = FALSE
   OR COALESCE(p.policy_count, 0) = 0
ORDER BY u.table_name;
