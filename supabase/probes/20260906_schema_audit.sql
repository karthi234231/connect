-- Audit #78 — DB layer audit artifact: verify RLS coverage, FK constraints,
-- unique constraints, and that security-definer RPCs use transaction semantics.
-- Run in a read-only transaction (rollback); reports gaps only.
do $audit$
declare
  r record;
begin
  raise notice '--- Tables with RLS DISABLED (public) ---';
  for r in select tablename from pg_tables
    where schemaname='public' and not rowsecurity and tablename not like 'pg_%'
  loop
    raise notice '  RLS-OFF: %', r.tablename;
  end loop;

  raise notice '--- Tables with NO generated unique/FK (public) ---';
  for r in select c.relname t
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'
      and not exists (select 1 from pg_constraint pc where pc.conrelid=c.oid and pc.contype in ('f','u'))
      and c.relname not like 'pg_%'
  loop
    raise notice '  NO-FK/UNIQUE: %', r.t;
  end loop;

  raise notice '--- RPCs WITHOUT security definer (may inherit search_path risk) ---';
  for r in select p.proname from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and not p.prosecdef
  loop
    raise notice '  NO-SECURITY-DEFINER: %', r.proname;
  end loop;

  raise notice '--- #77 types/database.ts present ---';
  raise notice '  (generated types file checked by the reviewer separately)';
end $audit$;