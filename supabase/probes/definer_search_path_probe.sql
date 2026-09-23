-- DB-02 MEDIUM — Every SECURITY DEFINER function needs a pinned search_path.
--
-- A SECURITY DEFINER function runs with the privileges of its owner. Without
-- a pinned search_path, an attacker can inject objects into the function's
-- default search_path, causing it to execute arbitrary code. This probe asserts
-- that every SECURITY DEFINER function in the public schema has an explicit
-- SET search_path clause.
--
-- Acceptance: zero rows returned (no offenders). A non-empty result means at
-- least one definer function lacks search_path pinning.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef IS TRUE
  AND n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_proc p2
    WHERE p2.oid = p.oid
      AND pg_get_functiondef(p2.oid) ~* 'set search_path'
  )
ORDER BY n.nspname, p.proname;
