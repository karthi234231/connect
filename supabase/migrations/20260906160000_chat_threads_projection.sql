begin;

-- Session 25 (#54): chat inbox must be O(threads), not O(total messages).
-- Projection maintained transactionally by triggers on messages.

create table if not exists public.chat_threads (
  match_id uuid primary key references public.matches(id) on delete cascade,
  last_message_id uuid,
  last_message_at timestamptz,
  last_message_content text,
  last_message_sender_id uuid,
  unread_user1 integer not null default 0,
  unread_user2 integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.chat_threads enable row level security;

create policy "Users can read their thread projections"
  on public.chat_threads for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = chat_threads.match_id
        and (m.user1_id = auth.uid() or m.user2_id = auth.uid())
    )
  );

-- New message: advance last-message fields, bump the recipient's counter.
create or replace function public.trg_chat_thread_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_threads (
    match_id, last_message_id, last_message_at,
    last_message_content, last_message_sender_id
  ) values (
    new.match_id, new.id, new.created_at, new.content, new.sender_id
  )
  on conflict (match_id) do update
    set last_message_id       = excluded.last_message_id,
        last_message_at       = excluded.last_message_at,
        last_message_content  = excluded.last_message_content,
        last_message_sender_id = excluded.last_message_sender_id,
        updated_at            = now()
    where excluded.last_message_at >= public.chat_threads.last_message_at;

  update public.chat_threads t
     set unread_user1 = t.unread_user1 + (case when m.user1_id <> new.sender_id then 1 else 0 end),
         unread_user2 = t.unread_user2 + (case when m.user2_id <> new.sender_id then 1 else 0 end)
    from public.matches m
   where m.id = t.match_id and t.match_id = new.match_id;

  return new;
end;
$$;

drop trigger if exists chat_thread_on_message on public.messages;
create trigger chat_thread_on_message
  after insert on public.messages
  for each row execute function public.trg_chat_thread_on_message();

-- Read receipt: decrement the reader's counter exactly once (null -> ts).
create or replace function public.trg_chat_thread_on_read()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.read_at is null and new.read_at is not null then
    update public.chat_threads t
       set unread_user1 = greatest(t.unread_user1 - (case when m.user1_id = new.sender_id then 1 else 0 end), 0),
           unread_user2 = greatest(t.unread_user2 - (case when m.user2_id = new.sender_id then 1 else 0 end), 0)
      from public.matches m
     where m.id = t.match_id and t.match_id = new.match_id;
  end if;
  return new;
end;
$$;

drop trigger if exists chat_thread_on_read on public.messages;
create trigger chat_thread_on_read
  after update of read_at on public.messages
  for each row execute function public.trg_chat_thread_on_read();

-- Backfill existing history.
insert into public.chat_threads (
  match_id, last_message_id, last_message_at,
  last_message_content, last_message_sender_id
)
select distinct on (match_id)
  match_id, id, created_at, content, sender_id
from public.messages
order by match_id, created_at desc, id desc
on conflict (match_id) do nothing;

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