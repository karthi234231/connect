-- S034: Chat attachments — private storage bucket with bounded size/type.
-- Bucket: match-attachments (private). Path contract: match-attachments/{matchId}/{uuid}.{ext}
-- Access: only match participants may read/write objects under their match prefix.
-- Rollback: delete bucket + policies (drop policy / delete storage.buckets row).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'match-attachments',
  'match-attachments',
  false,
  10485760, -- 10 MB
  array[
    'image/png','image/jpeg','image/webp','image/gif',
    'application/pdf','text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

-- Security-definer helper: is the caller a participant of this match?
-- Purpose: storage.objects RLS cannot query matches through its own policies.
create or replace function public.can_access_match_attachment(bucket text, object_name text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_match_id text;
  v_user_id  uuid;
begin
  if bucket <> 'match-attachments' then
    return false;
  end if;

  -- Path contract: match-attachments/{matchId}/{uuid}.{ext}
  v_match_id := split_part(object_name, '/', 2);
  if v_match_id is null or v_match_id = '' then
    return false;
  end if;

  v_user_id := auth.uid();
  if v_user_id is null then
    return false;
  end if;

  return exists (
    select 1 from public.matches m
    where m.id::text = v_match_id
      and (m.user1_id = v_user_id or m.user2_id = v_user_id)
  );
end;
$$;

-- Read: participants can read their match's attachments.
create policy "match-attachments-read-participants"
on storage.objects for select
to authenticated
using (public.can_access_match_attachment(bucket_id, name));

-- Write: participants can upload ONLY under their own match prefix.
create policy "match-attachments-insert-participants"
on storage.objects for insert
to authenticated
with check (public.can_access_match_attachment(bucket_id, name));
