-- Create audit_logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor UUID NOT NULL, -- user_id or service_role
  action TEXT NOT NULL, -- e.g., 'profile_updated', 'match_created'
  table_name TEXT,
  row_id UUID,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on audit_logs (only admins can read)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.app_role = 'admin'
    )
  );

-- Trigger function to automatically log changes on sensitive tables (optional)
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (actor, action, table_name, row_id, meta)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    NEW.id,
    row_to_json(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example: trigger on profiles (can be enabled later)
-- CREATE TRIGGER audit_profiles
-- AFTER INSERT OR UPDATE OR DELETE ON profiles
-- FOR EACH ROW EXECUTE FUNCTION log_audit_event();