-- DB-06 MEDIUM — updated_at triggers + audit coverage for mutable tables.
--
-- Every table with an `updated_at` column should have a BEFORE UPDATE trigger
-- that calls `public.touch_updated_at()` to keep it current. Additionally,
-- every user-scoped mutable table should write to the audit log via
-- `public.log_audit_event()` (or the service-layer `writeAuditLog` helper).
--
-- This probe has two parts:
--   Part 1: tables with updated_at but NO touch_updated_at trigger → gap.
--   Part 2: user-scoped tables with NO audit trigger → gap.
--
-- Acceptance: zero rows returned from both parts.

\echo '=== DB-06: Tables with updated_at but no touch_updated_at trigger ==='
SELECT
  tg.relname AS table_name,
  'MISSING updated_at trigger' AS issue
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
LEFT JOIN pg_trigger t ON t.tgrelid = c.oid
  AND t.tgname = format('%s_touch_updated_at', c.relname)
  AND t.tgenabled = 'O'  -- enabled
LEFT JOIN pg_class tg ON tg.oid = t.tgrelid
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND a.attname = 'updated_at'
  AND t.oid IS NULL
ORDER BY c.relname;

\echo '=== DB-06: User-scoped tables with no audit trail ==='
-- A table has audit coverage if it has an AFTER INSERT/UPDATE/DELETE trigger
-- that writes to audit_logs, OR the service layer is known to call writeAuditLog
-- for that table. This probe checks for trigger-based coverage only (the service
-- layer is audited separately via code review).
WITH user_scoped AS (
  SELECT DISTINCT c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND a.attname IN (
      'user_id', 'owner_id', 'requester_id', 'addressee_id',
      'blocker_id', 'blocked_id', 'reporter_id', 'reported_id',
      'host_id', 'sender_id', 'actor_id', 'updated_by',
      'organizer_id', 'candidate_id'
    )
)
SELECT
  u.table_name,
  'NO audit trigger found (service-layer audit not checked)' AS issue
FROM user_scoped u
LEFT JOIN pg_trigger t ON t.tgrelid = u.table_name::regclass
  AND t.tgname LIKE '%audit%'
  AND t.tgenabled = 'O'
WHERE t.oid IS NULL
  AND u.table_name NOT IN (
    -- Tables audited via service-layer writeAuditLog — excluded from trigger check.
    'profiles', 'ideas', 'matches', 'messages',
    'notification_preferences', 'notification_settings',
    'device_subscriptions', 'feedback', 'alerts'
  )
ORDER BY u.table_name;
