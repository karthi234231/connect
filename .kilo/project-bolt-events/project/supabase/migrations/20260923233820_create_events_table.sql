/*
# Create events table (single-tenant, no auth)

1. New Tables
- `events`
  - `id` (uuid, primary key)
  - `title` (text, not null) — event name
  - `description` (text, not null) — event description
  - `host` (text, not null) — who is hosting
  - `location` (text, not null) — where the event is held
  - `format` (text, not null) — 'Online' or 'In person'
  - `duration` (text, not null) — e.g. "90 min", "2 hrs"
  - `attendees` (integer, default 0) — current registration count
  - `capacity` (integer, not null) — max attendees
  - `category` (text, not null) — e.g. "Community", "Founders", "Learning"
  - `type` (text, not null) — 'workshop', 'coffee', or 'build night'
  - `tone` (text, not null) — tailwind gradient classes for card banner
  - `tags` (text[], default '{}') — array of tag strings
  - `event_date` (date, not null) — when the event takes place
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `events`.
- Allow anon + authenticated full CRUD because the data is intentionally shared/public (no sign-in).

3. Notes
- This is a single-tenant app with no authentication. All events are public/shared.
- The `tone` column stores CSS gradient class strings used for card visual styling.
- `tags` is a text array for flexible tagging.
*/

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  host text NOT NULL,
  location text NOT NULL,
  format text NOT NULL DEFAULT 'Online',
  duration text NOT NULL DEFAULT '60 min',
  attendees integer NOT NULL DEFAULT 0,
  capacity integer NOT NULL DEFAULT 50,
  category text NOT NULL DEFAULT 'Community',
  type text NOT NULL DEFAULT 'workshop',
  tone text NOT NULL DEFAULT 'from-[#7565b2] via-[#a895d0] to-[#e4b896]',
  tags text[] DEFAULT '{}',
  event_date date NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_events" ON events;
CREATE POLICY "anon_select_events" ON events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_events" ON events;
CREATE POLICY "anon_insert_events" ON events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_events" ON events;
CREATE POLICY "anon_update_events" ON events FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_events" ON events;
CREATE POLICY "anon_delete_events" ON events FOR DELETE
  TO anon, authenticated USING (true);

-- Seed with initial events
INSERT INTO events (title, description, host, location, format, duration, attendees, capacity, category, type, tone, tags, event_date)
VALUES
  (
    'Designing for belonging',
    'A practical workshop for creating teams where people can do their best work. We will explore patterns that foster psychological safety, inclusive rituals, and the small design choices that make people feel they belong.',
    'Good Work Club',
    'Online',
    'Online',
    '90 min',
    24,
    60,
    'Community',
    'workshop',
    'from-[#7565b2] via-[#a895d0] to-[#e4b896]',
    ARRAY['Belonging', 'Team culture'],
    '2026-09-24'
  ),
  (
    'A quieter way to build',
    'A small founder circle on sustainable pace, focus, and building with care. Limited to 35 seats for an intimate conversation about building without burnout.',
    'Northstar community',
    'London, UK',
    'In person',
    '2 hrs',
    18,
    35,
    'Founders',
    'coffee',
    'from-[#875339] via-[#c58c5d] to-[#e7c996]',
    ARRAY['Founders', 'Small group'],
    '2026-10-02'
  ),
  (
    'The craft of better questions',
    'An interactive session for turning good curiosity into useful conversations. Learn frameworks that help you ask questions that open doors rather than close them.',
    'Independent practitioners',
    'Online',
    'Online',
    '60 min',
    31,
    80,
    'Learning',
    'workshop',
    'from-[#397978] via-[#70aaa0] to-[#c6d7b5]',
    ARRAY['Learning', 'Facilitation'],
    '2026-10-09'
  )
ON CONFLICT DO NOTHING;
