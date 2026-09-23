-- Discovery model: authenticated users may read other users' public and
-- recruiting profiles (the app reads these from the raw `profiles` table in
-- dashboard discover, match lists, chat and connections). Private and stealth
-- profiles remain readable only by their owner (see "Users can read their own
-- profile" policy). Writes are unchanged — users can only modify their own row.
drop policy if exists "Users can read public profiles" on profiles;
create policy "Users can read public profiles"
  on profiles for select
  using (visibility in ('public', 'recruiting'));