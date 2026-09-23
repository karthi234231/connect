-- S035: Chat message search.
-- Index purpose: prefix/word search over message content without sequential scans;
-- 'simple' config (no stemming) keeps tech-slang searchable and index small.
-- Expected query pattern: participant-scoped, bounded (<=20 rows), keyset by created_at.
-- Rollback: drop function public.search_messages; drop index messages_content_fts_idx.

create index messages_content_fts_idx
  on public.messages using gin (to_tsvector('simple', content));

-- Security-invoker RPC (RLS on messages applies to the caller).
-- Authorization: for a scoped search the caller must be a match participant;
-- for global search each returned row must belong to a match the caller participates in.
create or replace function public.search_messages(
  p_query   text,
  p_match_id uuid default null,
  p_before   timestamptz default null,
  p_limit    int default 20
)
returns table (
  id         uuid,
  match_id   uuid,
  sender_id  uuid,
  content    text,
  created_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select m.id, m.match_id, m.sender_id, m.content, m.created_at
  from public.messages m
  join public.matches mt on mt.id = m.match_id
  where
    (mt.user1_id = auth.uid() or mt.user2_id = auth.uid())
    and to_tsvector('simple', m.content) @@ websearch_to_tsquery('simple', p_query)
    and (p_match_id is null or m.match_id = p_match_id)
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 20);
$$;

grant execute on function public.search_messages(text, uuid, timestamptz, int) to authenticated;
