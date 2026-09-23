begin;
insert into public.matches (user1_id,user2_id,status)
values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','pending');

-- legal: pending -> active
update public.matches set status='active'
where user1_id='00000000-0000-0000-0000-000000000003' and user2_id='00000000-0000-0000-0000-000000000004';
select 'legal_pending_to_active=' || status from public.matches
where user1_id='00000000-0000-0000-0000-000000000003' and user2_id='00000000-0000-0000-0000-000000000004';

rollback;

begin;
insert into public.matches (user1_id,user2_id,status)
values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','pending');

-- set active first, then attempt the illegal active -> pending
update public.matches set status='active'
where user1_id='00000000-0000-0000-0000-000000000003' and user2_id='00000000-0000-0000-0000-000000000004';
update public.matches set status='pending'
where user1_id='00000000-0000-0000-0000-000000000003' and user2_id='00000000-0000-0000-0000-000000000004';
select 'UNREACHABLE_ILLEGAL_ALLOWED' as bad;
rollback;

begin;
insert into public.matches (user1_id,user2_id,status)
values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','pending');

-- legal: pending -> declined
update public.matches set status='declined'
where user1_id='00000000-0000-0000-0000-000000000003' and user2_id='00000000-0000-0000-0000-000000000004';
select 'legal_pending_to_declined=' || status from public.matches
where user1_id='00000000-0000-0000-0000-000000000003' and user2_id='00000000-0000-0000-0000-000000000004';

-- illegal: declined -> active (must raise)
update public.matches set status='active'
where user1_id='00000000-0000-0000-0000-000000000003' and user2_id='00000000-0000-0000-0000-000000000004';
select 'UNREACHABLE_DECLINED_TO_ACTIVE' as bad2;
rollback;
