-- DB-05 HIGH — GDPR erase completeness: extend to newly added user-data tables.
--
-- sp_hard_erase_user was last defined in 20260908010000_gdpr_erase_phased_terminal_state.sql
-- but several user-scoped tables were added AFTER that migration:
--   profile_education, profile_experiences, profile_provider_connections,
--   recommendation_scores, match_relationship_settings,
--   relationship_suggestion_dismissals, notification_deliveries,
--   message_reactions.
--
-- Most cascade via ON DELETE CASCADE to profiles/matches/messages, but the
-- erase verification step must enumerate them explicitly (DB-05:
-- "table-enumerated"). This migration also fixes DB-02 by adding
-- `set search_path = public` to the definer function.
begin;

create or replace function public.sp_hard_erase_user(
  p_user_id uuid,
  p_request_id uuid,
  p_mark_completed boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
    _job           record;
    _rows_deleted  bigint := 0;
    _row_count     bigint;
begin
    -- Look up the erase request (durable record; must survive completion per #21)
    select * into _job
    from public.export_requests
    where id = p_request_id and user_id = p_user_id and status = 'pending' and request_type = 'erase'
    for update;

    if not found then
        return jsonb_build_object(
            'ok', false,
            'reason', case
                when not exists (select 1 from public.export_requests where id = p_request_id)
                then 'request_not_found'
                else 'already_processing'
            end
        );
    end if;

    -- Claim the job (prevents double-processing)
    update public.export_requests
       set status = 'processing'
     where id = _job.id;

    -- Registry-driven deletion (dependency-ordered).
    -- 1. Match-scoped dependents (before matches are removed)
    delete from public.match_timeline where match_id in (select id from public.matches where user1_id = p_user_id or user2_id = p_user_id);
    get diagnostics _rows_deleted = row_count;
    delete from public.messages where match_id in (select id from public.matches where user1_id = p_user_id or user2_id = p_user_id);
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;

    -- 2. Matches, connections, blocks (pair / bi-directional tables)
    delete from public.matches where user1_id = p_user_id or user2_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.connection_requests where requester_id = p_user_id or addressee_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.blocks where blocker_id = p_user_id or blocked_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;

    -- 3. Reports (reporter/reported identity)
    delete from public.reports
     where reporter_id = p_user_id or reported_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;

    -- 4. Ideas + their dependents
    delete from public.idea_interests where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.join_requests where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.team_memberships where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.idea_revisions where idea_id in (select id from public.ideas where owner_id = p_user_id);
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.ideas where owner_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;

    -- 5. Event attendance (only the user's own rows)
    delete from public.event_attendees where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.event_registrations where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.event_registration_idempotency where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;

    -- 6. Profiles + user-scoped tables
    delete from public.profiles where id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.user_skills where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    update public.matching_weights set updated_by = null where updated_by = p_user_id;
    delete from public.recommendations where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.notifications where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.notification_preferences where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.notification_settings where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.alerts where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.device_subscriptions where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.feedback where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;

    -- 6b. Events owned by this user (cascade removes children)
    delete from public.events where organizer_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;

    -- 6c. Provider-sourced profile extensions (added after v0.1)
    delete from public.profile_education where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.profile_experiences where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.profile_provider_connections where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;

    -- 6d. Server-owned recommendation scores (user as recommender)
    delete from public.recommendation_scores where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;

    -- 6e. Directional relationship settings + suggestion dismissals
    delete from public.match_relationship_settings where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;
    delete from public.relationship_suggestion_dismissals where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;

    -- 6f. Message reactions (user-authored)
    delete from public.message_reactions where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;

    -- 6g. Notification delivery outbox
    delete from public.notification_deliveries where user_id = p_user_id;
    get diagnostics _row_count = row_count;
    _rows_deleted := _rows_deleted + _row_count;

    -- 7. Anonymize identity in retained audit/analytics rows (#18, #20)
    update public.analytics_events set actor_id = null where actor_id = p_user_id::text;
    update public.audit_logs set actor_id = null where actor_id = p_user_id;

    -- 8. Verification: zero removable personal data should remain
    if exists (select 1 from public.profiles where id = p_user_id)
       or exists (select 1 from public.user_skills where user_id = p_user_id)
       or exists (select 1 from public.matches where user1_id = p_user_id or user2_id = p_user_id)
       or exists (select 1 from public.messages where match_id in (select id from public.matches where user1_id = p_user_id or user2_id = p_user_id))
       or exists (select 1 from public.connection_requests where requester_id = p_user_id or addressee_id = p_user_id)
       or exists (select 1 from public.blocks where blocker_id = p_user_id or blocked_id = p_user_id)
       or exists (select 1 from public.reports where reporter_id = p_user_id or reported_id = p_user_id)
       or exists (select 1 from public.ideas where owner_id = p_user_id)
       or exists (select 1 from public.team_memberships where user_id = p_user_id)
       or exists (select 1 from public.idea_interests where user_id = p_user_id)
       or exists (select 1 from public.join_requests where user_id = p_user_id)
       or exists (select 1 from public.idea_revisions where idea_id in (select id from public.ideas where owner_id = p_user_id))
       or exists (select 1 from public.event_attendees where user_id = p_user_id)
       or exists (select 1 from public.event_registrations where user_id = p_user_id)
       or exists (select 1 from public.event_registration_idempotency where user_id = p_user_id)
       or exists (select 1 from public.notifications where user_id = p_user_id)
       or exists (select 1 from public.notification_preferences where user_id = p_user_id)
       or exists (select 1 from public.notification_settings where user_id = p_user_id)
       or exists (select 1 from public.alerts where user_id = p_user_id)
       or exists (select 1 from public.device_subscriptions where user_id = p_user_id)
       or exists (select 1 from public.feedback where user_id = p_user_id)
       or exists (select 1 from public.recommendations where user_id = p_user_id)
       or exists (select 1 from public.events where organizer_id = p_user_id)
       or exists (select 1 from public.matching_weights where updated_by = p_user_id)
       or exists (select 1 from public.match_timeline where match_id in (select id from public.matches where user1_id = p_user_id or user2_id = p_user_id))
       or exists (select 1 from public.profile_education where user_id = p_user_id)
       or exists (select 1 from public.profile_experiences where user_id = p_user_id)
       or exists (select 1 from public.profile_provider_connections where user_id = p_user_id)
       or exists (select 1 from public.recommendation_scores where user_id = p_user_id)
       or exists (select 1 from public.match_relationship_settings where user_id = p_user_id)
       or exists (select 1 from public.relationship_suggestion_dismissals where user_id = p_user_id)
       or exists (select 1 from public.message_reactions where user_id = p_user_id)
       or exists (select 1 from public.notification_deliveries where user_id = p_user_id)
    then
        raise exception 'GDPR erasure verification failed: personal data remains for user %', p_user_id
            using hint = 'Aborting before marking job completed; manual investigation required.';
    end if;

    -- 9. Storage cleanup is handled in the erase service via the Storage API
    --    (storage.protect_delete prevents direct DELETE on storage.objects).

    -- 10. Mark job completed only when caller opts in (default true for RPC
    --     backward compat). The phased flow: RPC returns with status=processing,
    --     the app layer deletes the auth account, then marks completed/fulfilled.
    --     If auth deletion fails, the job stays in processing and is retried.
    if p_mark_completed then
        update public.export_requests
           set status = 'completed',
               fulfilled_at = now()
         where id = p_request_id;
    end if;

    -- 11. Audit trail (non-identifying actor; reference = job_id only, per #20)
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
    values (null, 'gdpr.erase', 'gdpr_job', p_request_id,
            jsonb_build_object('rows_removed', _rows_deleted), now());

    return jsonb_build_object(
        'ok', true,
        'request_id', p_request_id,
        'rows_removed', _rows_deleted,
        'timestamp', now()
    );
end;
$func$;

-- Grant the 3-arg overload. Drop the obsolete 2-arg overload so exactly ONE
-- production sp_hard_erase_user signature remains callable.
revoke execute on function public.sp_hard_erase_user(uuid, uuid, boolean) from public;
grant execute on function public.sp_hard_erase_user(uuid, uuid, boolean) to authenticated;
grant execute on function public.sp_hard_erase_user(uuid, uuid, boolean) to service_role;

drop function if exists public.sp_hard_erase_user(uuid, uuid);

commit;
