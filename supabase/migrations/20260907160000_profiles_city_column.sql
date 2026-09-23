-- Mini Session 4 (V10-BE-05 / V10-FE-04): city-only location slot.
-- Optional single value, absent by default. City-only profile display policy:
-- timezone is a scheduling datum, never a profile display field once city
-- resolution lands. The city-resolution/LinkedIn service fills this column; UI only
-- ever shows it when present (never fabricated).
begin;

alter table public.profiles
  add column if not exists city text;

commit;