-- S40 — waitlist promotion domain event.
-- A released slot promotes the next eligible waitlisted user (cancel RPC already
-- claims via FOR UPDATE SKIP LOCKED). The promoted user gets exactly one "you're
-- in" notification, surfaced through the existing outbox-backed notification
-- pipeline. Requires a new notification_type enum value.
alter type public.notification_type add value if not exists 'event_waitlist_promoted';