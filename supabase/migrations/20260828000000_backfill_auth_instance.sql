-- Backfill the single missing auth instance row and assign all seed users to it.
-- GoTrue v2.194.0 scopes auth.users by instance; seed SQL inserts users with
-- instance_id = NULL, so they're invisible to /auth/v1 until backfilled.
WITH inst AS (
  INSERT INTO auth.instances (id, uuid, raw_base_config, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    gen_random_uuid(),
    ('{"site_url":"http://127.0.0.1:3000"}'::jsonb),
    now(),
    now()
  )
  ON CONFLICT DO NOTHING
  RETURNING id
)
SELECT (SELECT id FROM inst) AS instance_id;

UPDATE auth.users
  SET instance_id = (SELECT id FROM auth.instances LIMIT 1),
      updated_at  = now()
  WHERE instance_id IS NULL;

-- Also backfill profiles whose auth.users FK may be stale (defensive).
UPDATE public.profiles
  SET updated_at = now()
  WHERE updated_at IS NULL;
