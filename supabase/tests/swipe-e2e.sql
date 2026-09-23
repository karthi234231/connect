﻿-- E2E probe for perform_swipe + P0-10 daily quota (rolls back all data).
-- Seed users: Arjun (d3b07384-...) and Priya (2c1ea532-...).
begin;
select set_config('role','authenticated', true);

select set_config('request.jwt.claims', json_build_object('sub','d3b07384-d941-4b29-9927-1dc6358a1f6a')::text, true);
select 'A_likes_B=' || (public.perform_swipe('2c1ea532-3f4a-4a33-b8e0-63c8ec4e71f2', 'like'::public.recommendation_action) ->> 'match_created');
select 'A_quota_after_1=' || (public.perform_swipe('2c1ea532-3f4a-4a33-b8e0-63c8ec4e71f2', 'like'::public.recommendation_action) ->> 'quota_remaining');

select set_config('request.jwt.claims', json_build_object('sub','2c1ea532-3f4a-4a33-b8e0-63c8ec4e71f2')::text, true);
select 'B_likes_A=' || (public.perform_swipe('d3b07384-d941-4b29-9927-1dc6358a1f6a', 'like'::public.recommendation_action) ->> 'match_created');
select 'B_relikes_A=' || (public.perform_swipe('d3b07384-d941-4b29-9927-1dc6358a1f6a', 'like'::public.recommendation_action) ->> 'match_created');

select 'matches_for_pair=' || count(*) from public.matches
where status = 'active'
  and ((user1_id = 'd3b07384-d941-4b29-9927-1dc6358a1f6a' and user2_id = '2c1ea532-3f4a-4a33-b8e0-63c8ec4e71f2')
    or (user1_id = '2c1ea532-3f4a-4a33-b8e0-63c8ec4e71f2' and user2_id = 'd3b07384-d941-4b29-9927-1dc6358a1f6a'));

rollback;
