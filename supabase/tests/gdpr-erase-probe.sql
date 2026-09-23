-- GDPR hard-erase E2E probe (wrapped in a transaction; ROLLBACK restores seed data).
-- Target: seed user 00000000-0000-0000-0000-000000000003 ("Rohan Iyer").
-- Erase request uses a fixed UUID for determinism.

begin;

-- 1. Create a pending erase request for the target user
insert into public.export_requests (id, user_id, status, created_at)
values ('aaaaaaaa-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000003',
        'pending', now());

-- 1b. Seed a synthetic report referencing the user (as both reporter AND reported)
--     to prove the NOT NULL columns are anonymized (sentinel), not nulled/crashing.
insert into public.reports (id, reporter_id, reported_id, reason, status, created_at)
values ('cccccccc-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000003',
        'other', 'open', now());

-- 2. Execute the atomic hard-erase RPC
select public.sp_hard_erase_user(
    '00000000-0000-0000-0000-000000000003'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000003'::uuid
) as rpc_result;

-- 3. Post-erase: remaining personal data in every registry table (must all be 0)
select 'profiles' tbl, count(*) remaining from public.profiles where id = '00000000-0000-0000-0000-000000000003'
union all select 'user_skills', count(*) from public.user_skills where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'matches', count(*) from public.matches where user1_id = '00000000-0000-0000-0000-000000000003' or user2_id = '00000000-0000-0000-0000-000000000003'
union all select 'messages', count(*) from public.messages where match_id in (select id from public.matches where user1_id = '00000000-0000-0000-0000-000000000003' or user2_id = '00000000-0000-0000-0000-000000000003')
union all select 'match_timeline', count(*) from public.match_timeline where match_id in (select id from public.matches where user1_id = '00000000-0000-0000-0000-000000000003' or user2_id = '00000000-0000-0000-0000-000000000003')
union all select 'connection_requests', count(*) from public.connection_requests where requester_id = '00000000-0000-0000-0000-000000000003' or addressee_id = '00000000-0000-0000-0000-000000000003'
union all select 'blocks', count(*) from public.blocks where blocker_id = '00000000-0000-0000-0000-000000000003' or blocked_id = '00000000-0000-0000-0000-000000000003'
union all select 'ideas', count(*) from public.ideas where owner_id = '00000000-0000-0000-0000-000000000003'
union all select 'team_memberships', count(*) from public.team_memberships where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'idea_interests', count(*) from public.idea_interests where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'join_requests', count(*) from public.join_requests where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'event_attendees', count(*) from public.event_attendees where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'event_registrations', count(*) from public.event_registrations where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'event_reg_idempotency', count(*) from public.event_registration_idempotency where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'notifications', count(*) from public.notifications where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'notification_preferences', count(*) from public.notification_preferences where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'notification_settings', count(*) from public.notification_settings where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'alerts', count(*) from public.alerts where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'device_subscriptions', count(*) from public.device_subscriptions where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'feedback', count(*) from public.feedback where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'recommendations', count(*) from public.recommendations where user_id = '00000000-0000-0000-0000-000000000003'
-- DB-05 extension: newly added user-scoped tables beyond the original erase map
union all select 'profile_education', count(*) from public.profile_education where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'profile_experiences', count(*) from public.profile_experiences where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'profile_provider_connections', count(*) from public.profile_provider_connections where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'recommendation_scores', count(*) from public.recommendation_scores where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'match_relationship_settings', count(*) from public.match_relationship_settings where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'relationship_suggestion_dismissals', count(*) from public.relationship_suggestion_dismissals where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'message_reactions', count(*) from public.message_reactions where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'notification_deliveries', count(*) from public.notification_deliveries where user_id = '00000000-0000-0000-0000-000000000003'
union all select 'idea_revisions', count(*) from public.idea_revisions where idea_id in (select id from public.ideas where owner_id = '00000000-0000-0000-0000-000000000003')
-- anonymized (NULLed identity) — must be 0 direct references
union all select 'matching_weights.ref', count(*) from public.matching_weights where updated_by = '00000000-0000-0000-0000-000000000003'
union all select 'reports.ref', count(*) from public.reports where reporter_id = '00000000-0000-0000-0000-000000000003' or reported_id = '00000000-0000-0000-0000-000000000003'
union all select 'audit_logs.ref', count(*) from public.audit_logs where actor_id = '00000000-0000-0000-0000-000000000003'
union all select 'analytics_events.ref', count(*) from public.analytics_events where actor_id = '00000000-0000-0000-0000-000000000003';

-- 4. Erase job MUST survive and reach 'completed' (finding #21): not cascade-deleted
select id, user_id, status, fulfilled_at is not null as has_fulfilled_at
from public.export_requests where id = 'aaaaaaaa-0000-0000-0000-000000000003';

-- 5. SYSTEM audit actor for the erase (finding #20): no PII, reference = request_id
select actor_id, action, entity_type, entity_id, metadata
from public.audit_logs
where action = 'gdpr.erase' and entity_id = 'aaaaaaaa-0000-0000-0000-000000000003';

-- 6. Idempotency guards:
-- a) request_not_found (no such request)
select public.sp_hard_erase_user('00000000-0000-0000-0000-000000000003'::uuid, 'bbbbbbbb-0000-0000-0000-000000000003'::uuid) as r_not_found;
-- b) wrong user for the request (user 009 is not the request owner for request of 003)
select public.sp_hard_erase_user('00000000-0000-0000-0000-000000000009'::uuid, 'aaaaaaaa-0000-0000-0000-000000000003'::uuid) as r_wrong_user;

rollback;

-- 7. Post-rollback integrity: Rohan Iyer still present & matching_weights intact
select 'post_rollback_profile' check_name, count(*) val from public.profiles where id = '00000000-0000-0000-0000-000000000003';
select 'post_rollback_mw_rows' check_name, count(*) val from public.matching_weights;

