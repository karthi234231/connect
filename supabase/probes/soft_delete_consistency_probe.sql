-- DB-07 LOW — Soft-delete vs hard-delete consistency.
--
-- The DB layer uses two deletion semantics:
--   * Soft-delete: `suspended_at` column (profiles) — the row is retained.
--   * Hard-delete: GDPR erase (sp_hard_erase_user) — the row is removed.
--
-- This probe asserts the rule is consistent: no table mixes both semantics on
-- the same column, and the soft-delete column (if any) is the ONLY one that
-- should be used for user-deactivation. It surfaces:
--   1. Tables with a soft-delete-style column (ended_at, deleted_at, etc.)
--      that ALSO have a hard-delete path in sp_hard_erase_user.
--   2. Tables with a soft-delete column that is NEVER null-gated by RLS
--      (i.e. the soft-deleted row is still visible to its owner).
--
-- Acceptance: zero rows returned (no semantic mixing; soft-delete rows hidden
--             when the soft-delete column is set).

\echo '=== DB-07: Soft-delete columns that are not RLS-gated when set ==='
WITH soft_delete_cols AS (
  SELECT
    c.relname AS table_name,
    a.attname AS col_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND a.attname IN ('suspended_at', 'deleted_at', 'ended_at', 'archived_at')
)
SELECT
  s.table_name,
  s.col_name,
  'soft-delete column not checked by an RLS USING clause' AS issue
FROM soft_delete_cols s
LEFT JOIN pg_policy p ON p.polrelid = s.table_name::regclass
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_policy p2
  WHERE p2.polrelid = s.table_name::regclass
    AND p2.polcmd IN ('S', '*')  -- SELECT or ALL
    AND p2.polqual IS NOT NULL
    AND p2.polqual::text ~ format('(%s\s*IS\s*NULL|NOT\s+EXISTS.*%s)', s.col_name, s.col_name)
)
  AND s.table_name != 'pg_class'  -- safety
ORDER BY s.table_name;

\echo '=== DB-07: Tables in sp_hard_erase_user that ALSO have a soft-delete column ==='
WITH erase_tables AS (
  SELECT DISTINCT
    regexp_replace(
      regexp_split_to_table(
        pg_get_functiondef('public.sp_hard_erase_user(uuid,uuid,boolean)'::regprocedure),
        '\n'
      ),
      '^\s*delete from public\.(\w+).*', '\1', 'g'
    ) AS table_name
  FROM pg_proc
  WHERE proname = 'sp_hard_erase_user'
    AND pronamespace = 'public'::regnamespace
),
soft_delete_cols AS (
  SELECT DISTINCT c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND a.attname IN ('suspended_at', 'deleted_at', 'ended_at', 'archived_at')
)
SELECT
  e.table_name,
  'hard-delete target ALSO has a soft-delete column' AS issue
FROM erase_tables e
JOIN soft_delete_cols s ON s.table_name = e.table_name
WHERE e.table_name ~ '^[a-z_]+$'  -- filter out non-table strings from regex
ORDER BY e.table_name;
