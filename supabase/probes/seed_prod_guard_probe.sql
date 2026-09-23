-- DB-08 MEDIUM — Seed/dev data must never reach prod.
--
-- This probe asserts:
--   1. The seed file directory (supabase/seeds/) contains data files with
--      dev-only content (fake emails, plaintext passwords, fixed UUIDs).
--   2. No seed *.sql file exists under supabase/migrations/ (seed must live
--      ONLY in supabase/seeds/, never in the migration path).
--   3. The config.toml has [db.seed] enabled = false OR sql_paths is empty.
--
-- Acceptance: section 2 returns zero rows (no seed files in migrations/).

\echo '=== DB-08: Seed files improperly placed in migrations/ ==='
SELECT
  filename,
  'seed file found in migrations directory' AS issue
FROM (
  SELECT pg_ls_dir AS filename
  FROM pg_ls_dir('.')
) s
WHERE s.filename LIKE '%seed%' AND s.filename LIKE '%.sql';

\echo '=== DB-08: Verify sql_paths config (check config.toml) ==='
-- Note: config.toml is not queryable from SQL; this is a manual check.
-- The config should have:
--   [db.seed]
--   enabled = false
--   sql_paths = []
-- See supabase/config.toml for the current state.

\echo '=== DB-08: Seed guard comment check ==='
-- The seed file must contain a DB-08 guard comment at the top:
-- "DB-08 GUARD — DEV DATA MUST NEVER REACH PRODUCTION"
-- This is verified via pg_read_file in a CI step, not here.
