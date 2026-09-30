begin;

-- P0 (GAP-014): the original messages INSERT policy only asserted match
-- participation, so an authenticated participant could spoof messages as the
-- peer by writing `sender_id = <other user>`. Mirrors the message_reactions
-- insert policy: the actor must be BOTH a participant of the parent match AND
-- the recorded sender. Nothing else changes — reads, the send service (which
-- always writes `sender_id = auth.uid()` via the user-scoped client), and the
-- service-role seeds (RLS-bypassing) are unaffected.

drop policy if exists "Users can insert messages in their matches"
  on public.messages;

create policy "Users can insert messages in their matches"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.matches
      where matches.id = messages.match_id
        and (matches.user1_id = auth.uid() or matches.user2_id = auth.uid())
    )
  );

commit;