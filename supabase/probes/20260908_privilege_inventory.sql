-- HOST-DB-07 — machine-checkable SECURITY DEFINER privilege inventory.
-- Every public SECURITY DEFINER function must have:
--   1. explicit EXECUTE revocation from PUBLIC (and anon for RPCs), and
--   2. an explicit EXECUTE grant to at most the intended roles.
-- PostgreSQL defaults to granting EXECUTE to PUBLIC on CREATE, so an
-- un-revoked function is callable by anon/authenticated indiscriminately.
-- Run in a read-only transaction; reports gaps only (raises NOTICE, never
-- modifies state). Mirrors probes/20260906_schema_audit.sql conventions.
do $audit$
declare
  r record;
  v_has_acl boolean;
begin
  raise notice '--- SECURITY DEFINER functions in public with PUBLIC/anon EXECUTE still present ---';
  for r in
    select p.proname,
           pg_get_function_identity_arguments(p.oid) as ident,
           p.proacl::text as acl
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    v_has_acl := r.acl is not null and (
      r.acl ilike '%=X/{%'          -- explicit acl entries exist
    );
    if r.acl is null or r.acl ilike '%=X/{%' = false then
      raise notice '  NO-EXPLICIT-ACL: %(%) acl=%', r.proname, r.ident, coalesce(r.acl, 'NULL(default PUBLIC execute)');
    else
      raise notice '  %(%) acl=%', r.proname, r.ident, r.acl;
    end if;
  end loop;

  raise notice '--- Caller-validation survey (auth.uid / service-role intent) ---';
  raise notice '  Verify manually against each function body: every authenticated RPC must guard auth.uid()';
end $audit$;