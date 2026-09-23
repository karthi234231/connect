-- GDPR job-retention support for atomic hard-erase (#19/#21).
-- 1. Extend export_request_status enum with the processing/completed states
--    used by sp_hard_erase_user's durable job lifecycle.
-- 2. Break the profiles ON DELETE CASCADE so a hard-erase does NOT cascade-
--    delete the pending erase job before it can be marked completed. The job
--    row must survive completion for the audit/retention policy; its user_id
--    is anonymized (SET NULL) when the profile is erased.

alter type public.export_request_status add value if not exists 'processing';
alter type public.export_request_status add value if not exists 'completed';

-- Detach the job record from the profile lifecycle: user_id becomes nullable
-- and is set to NULL when the linked profile is deleted (identity severed,
-- job row retained per retention policy).
alter table public.export_requests drop constraint if exists export_requests_user_id_fkey;
alter table public.export_requests alter column user_id drop not null;
alter table public.export_requests
    add constraint export_requests_user_id_fkey
    foreign key (user_id) references public.profiles(id)
    on delete set null;