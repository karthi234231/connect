-- Mini Session 4 (V10-BE-05 / V10-BE-06): canonical offering[] intent column.
--
-- Complementary direction to looking_for: what the user offers to a
-- collaboration. Values are validated by zod at the trust boundary
-- (src/services/profiles/intent.ts) and carried by the canonical profile
-- projection. The empty default keeps legacy rows as "no intent declared" —
-- absence is never a negative identity judgment.
begin;

alter table public.profiles
  add column if not exists offering jsonb not null default '{"categories":[]}';

commit;