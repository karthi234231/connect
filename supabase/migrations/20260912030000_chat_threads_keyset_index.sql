-- S24: chat list keyset pagination streams the inbox ordered by
-- (last_message_at desc, match_id desc) from the chat_threads projection.
begin;

create index if not exists chat_threads_keyset_idx
  on public.chat_threads (last_message_at desc, match_id desc);

commit;