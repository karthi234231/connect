begin;

-- ============================================================================
-- Fix: the chat read-receipt trigger decremented the WRONG user's unread counter.
--
-- Counter semantics (derived from 20260906160000_chat_threads_projection.sql):
--   * unread_user1 = count of messages SENT BY user2 that user1 has not read
--     (insert trigger bumps it when m.user1_id <> new.sender_id)
--   * unread_user2 = count of messages SENT BY user1 that user2 has not read
--     (insert trigger bumps it when m.user2_id <> new.sender_id)
--
-- The old trg_chat_thread_on_read decremented:
--   unread_user1 when m.user1_id = new.sender_id   (sender == user1)
--   unread_user2 when m.user2_id = new.sender_id   (sender == user2)
-- i.e. it decremented the SENDER's counter. But a read receipt always fires on
-- the READER's behalf: chat.service markMessagesAsRead updates only rows where
-- sender_id <> userId, so the reader is provably the non-sender of that row.
-- The old condition never touched the counter that the insert trigger had
-- actually incremented, and it could only drive the sender's own counter down
-- (clamped at 0 by greatest()). This new trigger INVERTS that condition to
-- decrement the reader's counter.
-- ============================================================================

-- Corrected read-receipt function.
--   sender = user2  -> reader is user1 -> decrement unread_user1
--   sender = user1  -> reader is user2 -> decrement unread_user2
-- Mirrors the existing style (PL/pgSQL, security definer, search_path=public).
create or replace function public.decrement_chat_unread_on_read()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.read_at is null and new.read_at is not null then
    update public.chat_threads t
       set unread_user1 = greatest(
             t.unread_user1 - (case when m.user2_id = new.sender_id then 1 else 0 end),
             0
           ),
           unread_user2 = greatest(
             t.unread_user2 - (case when m.user1_id = new.sender_id then 1 else 0 end),
             0
           )
      from public.matches m
     where m.id = t.match_id and t.match_id = new.match_id;
  end if;
  return new;
end;
$$;

-- Atomically replace the inverted trigger (same name and event, no drop needed).
create or replace trigger chat_thread_on_read
  after update of read_at on public.messages
  for each row execute function public.decrement_chat_unread_on_read();

-- Idempotent repair: recompute both counters from the actual unread rows so
-- every existing thread whose counters were corrupted by the old trigger
-- self-corrects after deployment. Same derivation as the original backfill
-- (counts null read_at messages sent by the peer), so re-running is a no-op.
update public.chat_threads t
   set unread_user1 = s.u1,
       unread_user2 = s.u2
  from (
    select msg.match_id,
           count(*) filter (where msg.sender_id <> mt.user1_id) as u1,
           count(*) filter (where msg.sender_id <> mt.user2_id) as u2
      from public.messages msg
      join public.matches mt on mt.id = msg.match_id
     where msg.read_at is null
     group by msg.match_id, mt.user1_id, mt.user2_id
  ) s
 where s.match_id = t.match_id;

commit;