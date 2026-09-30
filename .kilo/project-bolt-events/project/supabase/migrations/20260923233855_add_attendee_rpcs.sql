/*
# Add attendee increment/decrement functions

1. New Functions
- `increment_attendees(event_id uuid)` — increments the attendees count for an event by 1, with a safety check so it never exceeds capacity.
- `decrement_attendees(event_id uuid)` — decrements the attendees count by 1, never going below 0.

2. Security
- Both functions are SECURITY DEFINER so they can run with elevated privileges.
- Granted EXECUTE to anon and authenticated roles.
*/

CREATE OR REPLACE FUNCTION increment_attendees(event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE events
  SET attendees = LEAST(attendees + 1, capacity)
  WHERE id = event_id AND attendees < capacity;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_attendees(event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE events
  SET attendees = GREATEST(attendees - 1, 0)
  WHERE id = event_id AND attendees > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_attendees TO anon, authenticated;
GRANT EXECUTE ON FUNCTION decrement_attendees TO anon, authenticated;
