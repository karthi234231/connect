-- S02 TODO-B unit 7: notification dedupe recipient-scoped and DB-enforced.
-- dedupe_key had a non-unique partial index only; dedupe was enforced in app
-- code via SELECT-then-INSERT (racy) and the check was not scoped to user_id
-- (one recipient's dedupe_key suppressed other recipients' notifications).
-- Recipient-scoped partial unique index makes the DB authoritative; the
-- repository treats a 23505 violation as "duplicate, no insert".

-- Safety: collapse any pre-existing dupes (keeps newest) before indexing.
delete from public.notifications a
using public.notifications b
where a.dedupe_key is not null
  and a.dedupe_key = b.dedupe_key
  and a.user_id = b.user_id
  and a.created_at < b.created_at;

drop index if exists public.notifications_dedupe_idx;

create unique index notifications_dedupe_recipient_unique
on public.notifications (user_id, dedupe_key)
where dedupe_key is not null;
