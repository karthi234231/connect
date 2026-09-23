-- Session 27 probe: #60/#61 score propagation in perform_swipe.
-- Wrapped in begin/rollback â€” safe against any DB.
begin;

-- Probe users (rolled back). profiles.id → auth.users(id), so auth users are
-- created first; profiles are inserted as postgres BEFORE dropping to
-- authenticated (profiles RLS blocks the authenticated role).
insert into auth.users (id, email, encrypted_password, aud, role, email_confirmed_at, instance_id, confirmation_token)
values
 ('11111111-1111-4111-8111-111111111111'::uuid,'probe-a@example.com','','authenticated','authenticated', now(), '00000000-0000-0000-0000-000000000000',''),
 ('22222222-2222-4222-8222-222222222222'::uuid,'probe-b@example.com','','authenticated','authenticated', now(), '00000000-0000-0000-0000-000000000000','')
on conflict (id) do nothing;

insert into public.profiles (id, full_name, skills, availability, timezone, looking_for, commitment_level, work_style, visibility, onboarding_status, onboarding_completed_at)
values
 ('11111111-1111-4111-8111-111111111111'::uuid,'Probe A','{}'::text[],'{}'::jsonb,'UTC','{}'::jsonb,'full_time','structured','public','completed', now()),
 ('22222222-2222-4222-8222-222222222222'::uuid,'Probe B','{}'::text[],'{}'::jsonb,'UTC','{}'::jsonb,'full_time','structured','public','completed', now())
on conflict (id) do nothing;

select set_config('role','authenticated',true);

-- Actor A likes B with the discover-pipeline score, then B likes A back.
select set_config('request.jwt.claims', json_build_object('sub','11111111-1111-4111-8111-111111111111')::text, true) as a_ctx;
select perform_swipe('22222222-2222-4222-8222-222222222222'::uuid,'like'::public.recommendation_action, 87::smallint) as a_swipe;

select set_config('request.jwt.claims', json_build_object('sub','22222222-2222-4222-8222-222222222222')::text, true) as b_ctx;
select perform_swipe('11111111-1111-4111-8111-111111111111'::uuid,'like'::public.recommendation_action, 92::smallint) as b_swipe_expect_match;

-- #60: recommendation rows carry real scores (87 for A, 92 for B).
select user_id, action, score from public.recommendations
where user_id in ('11111111-1111-4111-8111-111111111111'::uuid,'22222222-2222-4222-8222-222222222222')
order by user_id;

-- #61: match carries A's persisted score (87), not NULL.
select user1_id, user2_id, status, score from public.matches
where user1_id='11111111-1111-4111-8111-111111111111';

-- Timeline meta carries the score.
select event_type, meta->>'score' as meta_score from public.match_timeline
where match_id = (select id from public.matches where user1_id='11111111-1111-4111-8111-111111111111');

-- Re-swipe: A re-likes with a different score; persisted 87 must be kept.
select set_config('request.jwt.claims', json_build_object('sub','11111111-1111-4111-8111-111111111111')::text, true) as a_ctx2;
select perform_swipe('22222222-2222-4222-8222-222222222222'::uuid,'like'::public.recommendation_action, 50::smallint) as a_reswipe;
select score as reswipe_score_expect_87 from public.recommendations
where user_id='11111111-1111-4111-8111-111111111111';

-- Out-of-range score must be rejected.
do $$
begin
  begin
    perform public.perform_swipe('22222222-2222-4222-8222-222222222222'::uuid,'like'::public.recommendation_action, 101::smallint);
    raise exception 'PROBE FAIL: invalid_score not enforced';
  exception when others then
    if sqlerrm <> 'invalid_score' then raise exception 'PROBE FAIL: wrong error: %', sqlerrm; end if;
  end;
end $$;
select 'probe ok' as result;
rollback;

