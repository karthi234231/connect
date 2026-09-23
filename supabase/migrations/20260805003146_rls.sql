-- Enable RLS on all existing tables (from init.sql)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE matching_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- GRANT PERMISSIONS (fixes 42501 permission errors)
-- =====================================================

-- Profiles
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT SELECT (id, full_name, avatar_url, role, bio, skills, availability, timezone, looking_for, visibility, last_active_at) ON profiles TO anon;

-- Other tables
GRANT SELECT, INSERT, UPDATE, DELETE ON user_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON match_timeline TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON recommendations TO authenticated;
GRANT SELECT ON matching_weights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON feedback TO authenticated;

-- Service role (bypasses RLS, needed for tests / admin paths)
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_skills TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON matches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON match_timeline TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON recommendations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON matching_weights TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON feedback TO service_role;

-- =====================================================
-- RLS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
-- Profiles
CREATE POLICY "Users can read their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- user_skills
CREATE POLICY "Users can manage their own skills"
  ON user_skills FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- matches
CREATE POLICY "Users can read matches they participate in"
  ON matches FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create matches as user1"
  ON matches FOR INSERT
  WITH CHECK (auth.uid() = user1_id);

CREATE POLICY "Users can update their own matches"
  ON matches FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id)
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- messages
CREATE POLICY "Users can read messages in their matches"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
        AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages in their matches"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
        AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

-- match_timeline
CREATE POLICY "Users can read timeline of their matches"
  ON match_timeline FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_timeline.match_id
        AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

-- recommendations
CREATE POLICY "Users can read their own recommendations"
  ON recommendations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own recommendations"
  ON recommendations FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- matching_weights
CREATE POLICY "Anyone can read matching weights"
  ON matching_weights FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update matching weights"
  ON matching_weights FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.app_role = 'admin'
    )
  );

-- feedback
CREATE POLICY "Users can manage their own feedback"
  ON feedback FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- PUBLIC_PROFILES VIEW (for discovery)
-- =====================================================

CREATE OR REPLACE VIEW public_profiles AS
SELECT
  id,
  full_name,
  avatar_url,
  role,
  bio,
  skills,
  availability,
  timezone,
  looking_for,
  visibility,
  last_active_at,
  commitment_level,
  work_style,
  created_at,
  updated_at
FROM profiles
WHERE visibility IN ('public', 'recruiting');

GRANT SELECT ON public_profiles TO authenticated, anon;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.role() = 'authenticated';
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION is_match_participant(match_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM matches
    WHERE id = match_id
      AND (user1_id = auth.uid() OR user2_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql STABLE;