--- ============================================================
-- Connect - e2e profiles seed (01_profiles.sql)
--
-- Purpose: fully populate the EVERYTHING test profile for the real
-- user plus the 12 candidate profiles shown in the Discover feed.
--
-- Target user (real, already in auth.users + profiles):
--   id    b16b5b49-e640-4dbb-ab17-77bb3064d65f
--   email jogikarthik123@gmail.com
--   full_name updated from "Karthik" to "Karthik Jogi"
--
-- The 12 candidates (auth.users rows already exist; only their
-- public.profiles rows are UPDATED here):
--   00000000-0000-0000-0000-000000000001 .. 000000000000
--
-- Idempotent: UPDATEs for profiles, INSERT ... ON CONFLICT DO
-- NOTHING for user_skills / experiences / education, and
-- ON CONFLICT (user_id) DO UPDATE for provider connections.
-- Does NOT touch auth.users. Plain DML only.
--
-- Date: 2026-09-23
-- ============================================================

-- ============================================================
-- 1. Target user: Karthik Jogi (complete founder story)
-- ============================================================
update public.profiles
set full_name              = 'Karthik Jogi',
    avatar_url             = 'https://randomuser.me/api/portraits/men/85.jpg',
    role                   = 'founder',
    bio                    = 'Building Connect - the matching platform that pairs ambitious Indian builders with the right cofounders and teammates. Ex-B2B SaaS product lead. Looking for a founding engineer and a product designer to take the feed to the next level.',
    headline               = 'Founder & CEO, Connect',
    idea                   = 'Connect - a matching platform that connects Indian founders, engineers and designers using explainable scoring, warm intros and built-in chat.',
    city                   = 'Bengaluru',
    timezone               = 'Asia/Kolkata',
    commitment_level       = 'full_time',
    work_style             = 'flexible',
    visibility             = 'public',
    app_role               = 'user',
    skills                 = '{product_management,backend,growth}',
    availability           = '{"days":["mon","tue","wed","thu","fri","sat"],"hours":{"start":"09:00","end":"21:00"}}',
    looking_for            = '{"roles":["engineer","designer"]}',
    offering               = '{"categories":["matching","community"]}',
    social_links           = '{"github":"https://github.com/karthikjogi","linkedin":"https://linkedin.com/in/karthikjogi","twitter":"https://x.com/karthikjogi","portfolio":"https://karthikjogi.dev"}',
    notification_prefs     = '{"match_created":true,"intro_requested":true,"message_received":true,"event_reminder":true,"event_group_assigned":true}',
    onboarding_status      = 'completed',
    onboarding_completed_at = now() - interval '2 days',
    last_active_at          = now() - interval '25 minutes'
where id = 'b16b5b49-e640-4dbb-ab17-77bb3064d65f';

-- Targeted user_skills (mine + 2 more)
insert into public.user_skills (user_id, skill, proficiency)
values
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'product_management', 4),
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'backend', 3),
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'growth', 4)
on conflict (user_id, skill) do nothing;

-- LinkedIn-style experience (target user)
insert into public.profile_experiences
  (id, user_id, source, provider_external_id, company, title, started_at, ended_at, is_current, sort_order)
values
  ('a1000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'linkedin', null, 'Connect', 'Founder & CEO', '2025-01-01', null, true, 0),
  ('a1000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'linkedin', null, 'Freshworks', 'Senior Product Manager', '2021-06-01', '2024-12-31', false, 1),
  ('a1000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'linkedin', null, 'Zoho', 'Product Manager', '2018-04-01', '2021-05-31', false, 2)
on conflict (id) do nothing;

-- Education (target user)
insert into public.profile_education
  (id, user_id, provider_external_id, school, degree, field_of_study, started_at, ended_at, is_current, sort_order, source)
values
  ('a2000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', null, 'IIIT Hyderabad', 'B.Tech', 'Computer Science', '2014-08-01', '2018-05-31', false, 0, 'linkedin'),
  ('a2000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', null, 'IIM Bangalore', 'MBA', 'Business Administration', '2020-06-01', '2022-03-31', false, 1, 'linkedin')
on conflict (id) do nothing;

-- LinkedIn provider connection (target user) - PK is user_id, not composite
insert into public.profile_provider_connections
  (user_id, provider, provider_user_id, scopes, sync_state, last_attempt_at, last_success_at)
values
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'linkedin', 'karthik-jogi', '{r_liteprofile,r_emailaddress,r_basicprofile}', 'synced', now() - interval '3 days', now() - interval '3 days')
on conflict (user_id) do update
set provider = excluded.provider,
    provider_user_id = excluded.provider_user_id,
    scopes = excluded.scopes,
    sync_state = excluded.sync_state,
    last_attempt_at = excluded.last_attempt_at,
    last_success_at = excluded.last_success_at;

-- ============================================================
-- 2. Candidates (Discover feed cards) - 0001 .. 000c
-- ============================================================

-- 0001 Alice Chen - Frontend Engineer (Bengaluru)
update public.profiles
set full_name              = 'Alice Chen',
    avatar_url             = 'https://randomuser.me/api/portraits/women/44.jpg',
    role                   = 'engineer',
    bio                    = 'Frontend engineer with 6 years shipping consumer and B2B products across React, Next.js and design systems. Looking to plug into a 0-1 team this quarter.',
    headline               = 'Frontend Engineer',
    idea                   = 'Open to joining 0-1 teams as a founding frontend engineer - favourite canvas: dashboards, design systems, instant onboarding.',
    city                   = 'Bengaluru',
    timezone               = 'Asia/Kolkata',
    commitment_level       = 'part_time',
    work_style             = 'flexible',
    visibility             = 'public',
    app_role               = 'user',
    skills                 = '{frontend,react,fullstack,ui}',
    availability           = '{"days":["mon","tue","wed","thu","fri"],"hours":{"start":"18:00","end":"22:00"}}',
    looking_for            = '{"roles":["founder","designer"]}',
    offering               = '{"categories":["engineering","frontend"]}',
    social_links           = '{"github":"https://github.com/alicechen","linkedin":"https://linkedin.com/in/alicechen"}',
    onboarding_status      = 'completed',
    onboarding_completed_at = now() - interval '12 days',
    last_active_at          = now() - interval '3 hours'
where id = '00000000-0000-0000-0000-000000000001';

-- 0002 Bob Okafor - Backend Engineer / Distributed Systems (Mumbai)
update public.profiles
set full_name              = 'Bob Okafor',
    avatar_url             = 'https://randomuser.me/api/portraits/men/32.jpg',
    role                   = 'engineer',
    bio                    = 'Backend engineer obsessed with low-latency, high-throughput systems. Go, Kafka, Postgres; 8 years across payments and marketplaces in Mumbai.',
    headline               = 'Backend Engineer, Distributed Systems',
    idea                   = 'Prototyping an open-source event-streaming toolkit; want founder + infra collaborators who like hard problems.',
    city                   = 'Mumbai',
    timezone               = 'Asia/Kolkata',
    commitment_level       = 'nights_weekends',
    work_style             = 'structured',
    visibility             = 'public',
    app_role               = 'user',
    skills                 = '{backend,devops,kafka,postgres}',
    availability           = '{"days":["fri","sat","sun"],"hours":{"start":"19:00","end":"23:00"}}',
    looking_for            = '{"roles":["founder","engineer"]}',
    offering               = '{"categories":["engineering","infrastructure"]}',
    social_links           = '{"github":"https://github.com/bobokafor","linkedin":"https://linkedin.com/in/bobokafor"}',
    onboarding_status      = 'completed',
    onboarding_completed_at = now() - interval '12 days',
    last_active_at          = now() - interval '1 day'
where id = '00000000-0000-0000-0000-000000000002';

-- 0003 Carla Mendes - Product Designer (Pune)
update public.profiles
set full_name              = 'Carla Mendes',
    avatar_url             = 'https://randomuser.me/api/portraits/women/65.jpg',
    role                   = 'designer',
    bio                    = 'Product designer in Pune - fintech and healthtech, systems thinker and a complete Figma nerd. Open to 0-1 projects where design can move the needle.',
    headline               = 'Product Designer',
    idea                   = 'Exploring a design-led wellness companion; looking for a technical cofounder to prototype with.',
    city                   = 'Pune',
    timezone               = 'Asia/Kolkata',
    commitment_level       = 'part_time',
    work_style             = 'deliberate',
    visibility             = 'public',
    app_role               = 'user',
    skills                 = '{ui,ux,product_design,user_research}',
    availability           = '{"days":["tue","wed","thu","sat"],"hours":{"start":"10:00","end":"18:00"}}',
    looking_for            = '{"roles":["founder","engineer","product"]}',
    offering               = '{"categories":["design","user_research"]}',
    social_links           = '{"linkedin":"https://linkedin.com/in/carlamendes","portfolio":"https://behance.net/carlamendes"}',
    onboarding_status      = 'completed',
    onboarding_completed_at = now() - interval '12 days',
    last_active_at          = now() - interval '5 hours'
where id = '00000000-0000-0000-0000-000000000003';

-- 0004 David Kim - ML Engineer (Hyderabad)
update public.profiles
set full_name              = 'David Kim',
    avatar_url             = 'https://randomuser.me/api/portraits/men/45.jpg',
    role                   = 'data_ml',
    bio                    = 'ML engineer in Hyderabad building recommendation and retrieval systems. Published at two tier-2 conferences; equally happy shipping and researching.',
    headline               = 'ML Engineer',
    idea                   = 'Building a vernacular-content recommendation engine; also open to LLM-pipeline consulting for early startups.',
    city                   = 'Hyderabad',
    timezone               = 'Asia/Kolkata',
    commitment_level       = 'nights_weekends',
    work_style             = 'deliberate',
    visibility             = 'public',
    app_role               = 'user',
    skills                 = '{ml_ai,data,python,backend}',
    availability           = '{"days":["mon","wed","fri","sat"],"hours":{"start":"20:00","end":"23:00"}}',
    looking_for            = '{"roles":["founder","data_ml","engineer"]}',
    offering               = '{"categories":["data","ml"]}',
    social_links           = '{"github":"https://github.com/davidkim","linkedin":"https://linkedin.com/in/davidkim"}',
    onboarding_status      = 'completed',
    onboarding_completed_at = now() - interval '12 days',
    last_active_at          = now() - interval '2 days'
where id = '00000000-0000-0000-0000-000000000004';

-- 0005 Emma Novak - Growth Lead (Delhi)
update public.profiles
set full_name              = 'Emma Novak',
    avatar_url             = 'https://randomuser.me/api/portraits/women/68.jpg',
    role                   = 'growth',
    bio                    = 'Growth lead at a D2C brand in Delhi. Performance marketing, SEO, retention loops - I take products from zero to repeatable acquisition.',
    headline               = 'Growth Marketer',
    idea                   = 'Working on a retention playbook for D2C - wants a founding engineer to automate funnel analytics.',
    city                   = 'Delhi',
    timezone               = 'Asia/Kolkata',
    commitment_level       = 'full_time',
    work_style             = 'flexible',
    visibility             = 'public',
    app_role               = 'user',
    skills                 = '{growth,marketing,seo,content}',
    availability           = '{"days":["mon","tue","wed","thu","fri"],"hours":{"start":"09:30","end":"18:30"}}',
    looking_for            = '{"roles":["founder","product","engineer"]}',
    offering               = '{"categories":["growth","marketing"]}',
    social_links           = '{"twitter":"https://x.com/emmanovak","linkedin":"https://linkedin.com/in/emmanovak"}',
    onboarding_status      = 'completed',
    onboarding_completed_at = now() - interval '12 days',
    last_active_at          = now() - interval '40 minutes'
where id = '00000000-0000-0000-0000-000000000005';

-- 0006 Frank Delgado - Mobile Engineer (Chennai)
update public.profiles
set full_name              = 'Frank Delgado',
    avatar_url             = 'https://randomuser.me/api/portraits/men/22.jpg',
    role                   = 'engineer',
    bio                    = 'Mobile engineer who has shipped six consumer apps on React Native and Kotlin. Offline-first, India-scale problems are my happy place.',
    headline               = 'Mobile Engineer',
    idea                   = 'Partnering on an offline-first health record app for rural clinics; needs a designer and a backend friend.',
    city                   = 'Chennai',
    timezone               = 'Asia/Kolkata',
    commitment_level       = 'part_time',
    work_style             = 'structured',
    visibility             = 'public',
    app_role               = 'user',
    skills                 = '{mobile,frontend,fullstack}',
    availability           = '{"days":["mon","wed","thu","sat"],"hours":{"start":"19:00","end":"23:00"}}',
    looking_for            = '{"roles":["founder","designer"]}',
    offering               = '{"categories":["engineering","mobile"]}',
    social_links           = '{"github":"https://github.com/frankdelgado","portfolio":"https://frankdelgado.dev"}',
    onboarding_status      = 'completed',
    onboarding_completed_at = now() - interval '12 days',
    last_active_at          = now() - interval '8 hours'
where id = '00000000-0000-0000-0000-000000000006';

-- 0007 Grace Liu - Senior Product Manager (Bengaluru)
update public.profiles
set full_name              = 'Grace Liu',
    avatar_url             = 'https://randomuser.me/api/portraits/women/47.jpg',
    role                   = 'product',
    bio                    = 'Senior product manager in Bengaluru with a marketplace and B2B SaaS background. Building in public on weekends; want an engineer + designer to validate an MVP.',
    headline               = 'Senior Product Manager',
    idea                   = 'Stealth B2B SaaS for procurement. Talking to 15 buyers before writing code.',
    city                   = 'Bengaluru',
    timezone               = 'Asia/Kolkata',
    commitment_level       = 'part_time',
    work_style             = 'fast_iterate',
    visibility             = 'public',
    app_role               = 'user',
    skills                 = '{product_management,analytics,b2b}',
    availability           = '{"days":["sat","sun"],"hours":{"start":"10:00","end":"20:00"}}',
    looking_for            = '{"roles":["engineer","designer","growth"]}',
    offering               = '{"categories":["product","strategy"]}',
    social_links           = '{"linkedin":"https://linkedin.com/in/graceliu","twitter":"https://x.com/graceliu"}',
    onboarding_status      = 'completed',
    onboarding_completed_at = now() - interval '12 days',
    last_active_at          = now() - interval '26 hours'
where id = '00000000-0000-0000-0000-000000000007';

-- 0008 Henry Brown - Operations & Finance (Mumbai)
update public.profiles
set full_name              = 'Henry Brown',
    avatar_url             = 'https://randomuser.me/api/portraits/men/36.jpg',
    role                   = 'operations',
    bio                    = 'Operations and finance generalist who scaled a logistics startup from 10 to 200 people. Compliance, vendor management and unit economics are my bread and butter.',
    headline               = 'Operations & Finance',
    idea                   = 'Co-founding a last-mile delivery ops tool; running pilots with two kirana networks in Mumbai.',
    city                   = 'Mumbai',
    timezone               = 'Asia/Kolkata',
    commitment_level       = 'full_time',
    work_style             = 'structured',
    visibility             = 'public',
    app_role               = 'user',
    skills                 = '{operations,finance,logistics}',
    availability           = '{"days":["mon","tue","wed","thu","fri"],"hours":{"start":"09:00","end":"18:00"}}',
    looking_for            = '{"roles":["founder","engineer","growth"]}',
    offering               = '{"categories":["operations","finance"]}',
    social_links           = '{"linkedin":"https://linkedin.com/in/henrybrown"}',
    onboarding_status      = 'completed',
    onboarding_completed_at = now() - interval '12 days',
    last_active_at          = now() - interval '2 days'
where id = '00000000-0000-0000-0000-000000000008';

-- 0009 Isla Roth - Brand & Product Designer (Delhi)
update public.profiles
set full_name              = 'Isla Roth',
    avatar_url             = 'https://randomuser.me/api/portraits/women/26.jpg',
    role                   = 'designer',
    bio                    = 'Brand and product designer helping young startups look fundable - illustration, motion and Webflow. Open to founder partnerships.',
    headline               = 'Brand & Product Designer',
    idea                   = 'Starting a design studio for seed-stage startups; looking for product founders to partner with early.',
    city                   = 'Delhi',
    timezone               = 'Asia/Kolkata',
    commitment_level       = 'nights_weekends',
    work_style             = 'flexible',
    visibility             = 'public',
    app_role               = 'user',
    skills                 = '{branding,ui,illustration,ux}',
    availability           = '{"days":["sat","sun"],"hours":{"start":"11:00","end":"20:00"}}',
    looking_for            = '{"roles":["founder","engineer"]}',
    offering               = '{"categories":["design","branding"]}',
    social_links           = '{"portfolio":"https://dribbble.com/islaroth","linkedin":"https://linkedin.com/in/islaroth"}',
    onboarding_status      = 'completed',
    onboarding_completed_at = now() - interval '12 days',
    last_active_at          = now() - interval '3 days'
where id = '00000000-0000-0000-0000-000000000009';

-- 000a John Park - Founder (Hyderabad)
update public.profiles
set full_name              = 'John Park',
    avatar_url             = 'https://randomuser.me/api/portraits/men/54.jpg',
    role                   = 'founder',
    bio                    = 'Edtech founder in Hyderabad with 8k MAU on a vernacular upskilling product. Raising an angel round and hunting for a founding mobile engineer and a growth lead.',
    headline               = 'Founder & CEO',
    idea                   = 'Vernacular upskilling for tier-2 learners - 8k MAU, raising an angel round, need mobile engineer + growth lead.',
    city                   = 'Hyderabad',
    timezone               = 'Asia/Kolkata',
    commitment_level       = 'full_time',
    work_style             = 'fast_iterate',
    visibility             = 'recruiting',
    app_role               = 'user',
    skills                 = '{edtech,product_management,growth}',
    availability           = '{"days":["mon","tue","wed","thu","fri","sat"],"hours":{"start":"08:00","end":"21:00"}}',
    looking_for            = '{"roles":["engineer","growth","operations"]}',
    offering               = '{"categories":["community","education"]}',
    social_links           = '{"linkedin":"https://linkedin.com/in/johnpark","twitter":"https://x.com/johnpark"}',
    onboarding_status      = 'completed',
    onboarding_completed_at = now() - interval '12 days',
    last_active_at          = now() - interval '6 days'
where id = '00000000-0000-0000-0000-00000000000a';

-- 000b Kate Sharma - ML/NLP Engineer (Chennai)
update public.profiles
set full_name              = 'Kate Sharma',
    avatar_url             = 'https://randomuser.me/api/portraits/women/57.jpg',
    role                   = 'data_ml',
    bio                    = 'ML/NLP engineer in Chennai working on code-mixed and Indic language models. Curious about research-flavoured startups and open to nights + weekends.',
    headline               = 'ML / NLP Engineer',
    idea                   = 'Indic NLP tools - translation, transliteration and code-mixed understanding. Open to research-flavoured startups.',
    city                   = 'Chennai',
    timezone               = 'Asia/Kolkata',
    commitment_level       = 'nights_weekends',
    work_style             = 'deliberate',
    visibility             = 'public',
    app_role               = 'user',
    skills                 = '{ml_ai,nlp,python,data}',
    availability           = '{"days":["tue","thu","sun"],"hours":{"start":"20:00","end":"23:00"}}',
    looking_for            = '{"roles":["founder","data_ml","product"]}',
    offering               = '{"categories":["data","ml"]}',
    social_links           = '{"github":"https://github.com/katesharma","linkedin":"https://linkedin.com/in/katesharma"}',
    onboarding_status      = 'completed',
    onboarding_completed_at = now() - interval '12 days',
    last_active_at          = now() - interval '5 days'
where id = '00000000-0000-0000-0000-00000000000b';

-- 000c Leo Martins - Backend Engineer / Serverless (Pune)
update public.profiles
set full_name              = 'Leo Martins',
    avatar_url             = 'https://randomuser.me/api/portraits/men/71.jpg',
    role                   = 'engineer',
    bio                    = 'Backend engineer running serverless infrastructure for a 10M-MAU consumer app. Looking for a team building something meaningful for India.',
    headline               = 'Backend Engineer, Serverless',
    idea                   = 'Serverless-first microservices; has run infra on 10M MAU. Wants a like-minded team building for India.',
    city                   = 'Pune',
    timezone               = 'Asia/Kolkata',
    commitment_level       = 'part_time',
    work_style             = 'structured',
    visibility             = 'public',
    app_role               = 'user',
    skills                 = '{backend,devops,aws,serverless}',
    availability           = '{"days":["mon","tue","thu","sat"],"hours":{"start":"19:00","end":"23:00"}}',
    looking_for            = '{"roles":["founder","engineer"]}',
    offering               = '{"categories":["engineering","infrastructure"]}',
    social_links           = '{"github":"https://github.com/leomartins","linkedin":"https://linkedin.com/in/leomartins"}',
    onboarding_status      = 'completed',
    onboarding_completed_at = now() - interval '12 days',
    last_active_at          = now() - interval '12 hours'
where id = '00000000-0000-0000-0000-00000000000c';

-- ============================================================
-- 3. Candidate user_skills (matches each skills array)
-- ============================================================
insert into public.user_skills (user_id, skill, proficiency)
values
  -- 0001 Alice Chen
  ('00000000-0000-0000-0000-000000000001', 'frontend', 5),
  ('00000000-0000-0000-0000-000000000001', 'react', 4),
  ('00000000-0000-0000-0000-000000000001', 'ui', 4),
  ('00000000-0000-0000-0000-000000000001', 'fullstack', 3),
  -- 0002 Bob Okafor
  ('00000000-0000-0000-0000-000000000002', 'backend', 5),
  ('00000000-0000-0000-0000-000000000002', 'devops', 4),
  ('00000000-0000-0000-0000-000000000002', 'kafka', 4),
  ('00000000-0000-0000-0000-000000000002', 'postgres', 4),
  -- 0003 Carla Mendes
  ('00000000-0000-0000-0000-000000000003', 'ui', 5),
  ('00000000-0000-0000-0000-000000000003', 'ux', 4),
  ('00000000-0000-0000-0000-000000000003', 'product_design', 5),
  ('00000000-0000-0000-0000-000000000003', 'user_research', 4),
  -- 0004 David Kim
  ('00000000-0000-0000-0000-000000000004', 'ml_ai', 5),
  ('00000000-0000-0000-0000-000000000004', 'data', 5),
  ('00000000-0000-0000-0000-000000000004', 'python', 4),
  ('00000000-0000-0000-0000-000000000004', 'backend', 3),
  -- 0005 Emma Novak
  ('00000000-0000-0000-0000-000000000005', 'growth', 5),
  ('00000000-0000-0000-0000-000000000005', 'marketing', 4),
  ('00000000-0000-0000-0000-000000000005', 'seo', 4),
  ('00000000-0000-0000-0000-000000000005', 'content', 4),
  -- 0006 Frank Delgado
  ('00000000-0000-0000-0000-000000000006', 'mobile', 5),
  ('00000000-0000-0000-0000-000000000006', 'frontend', 4),
  ('00000000-0000-0000-0000-000000000006', 'fullstack', 4),
  -- 0007 Grace Liu
  ('00000000-0000-0000-0000-000000000007', 'product_management', 5),
  ('00000000-0000-0000-0000-000000000007', 'analytics', 4),
  ('00000000-0000-0000-0000-000000000007', 'b2b', 3),
  -- 0008 Henry Brown
  ('00000000-0000-0000-0000-000000000008', 'operations', 5),
  ('00000000-0000-0000-0000-000000000008', 'finance', 4),
  ('00000000-0000-0000-0000-000000000008', 'logistics', 4),
  -- 0009 Isla Roth
  ('00000000-0000-0000-0000-000000000009', 'branding', 5),
  ('00000000-0000-0000-0000-000000000009', 'ui', 4),
  ('00000000-0000-0000-0000-000000000009', 'illustration', 4),
  ('00000000-0000-0000-0000-000000000009', 'ux', 3),
  -- 000a John Park
  ('00000000-0000-0000-0000-00000000000a', 'edtech', 5),
  ('00000000-0000-0000-0000-00000000000a', 'product_management', 4),
  ('00000000-0000-0000-0000-00000000000a', 'growth', 4),
  -- 000b Kate Sharma
  ('00000000-0000-0000-0000-00000000000b', 'ml_ai', 5),
  ('00000000-0000-0000-0000-00000000000b', 'python', 4),
  ('00000000-0000-0000-0000-00000000000b', 'data', 4),
  ('00000000-0000-0000-0000-00000000000b', 'nlp', 3),
  -- 000c Leo Martins
  ('00000000-0000-0000-0000-00000000000c', 'backend', 5),
  ('00000000-0000-0000-0000-00000000000c', 'devops', 4),
  ('00000000-0000-0000-0000-00000000000c', 'aws', 4),
  ('00000000-0000-0000-0000-00000000000c', 'serverless', 4)
on conflict (user_id, skill) do nothing;

-- ============================================================
-- 4. Candidate profile_experiences (LinkedIn-style)
-- ============================================================
insert into public.profile_experiences
  (id, user_id, source, provider_external_id, company, title, started_at, ended_at, is_current, sort_order)
values
  -- 0001 Alice Chen
  ('a1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'linkedin', null, 'Postman', 'Senior Frontend Engineer', '2021-03-01', null, true, 0),
  ('a1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'linkedin', null, 'MakeMyTrip', 'Frontend Engineer', '2018-06-01', '2021-02-28', false, 1),
  -- 0002 Bob Okafor
  ('a1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 'linkedin', null, 'Razorpay', 'Staff Engineer, Payments Platform', '2019-07-01', null, true, 0),
  ('a1000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 'linkedin', null, 'Flipkart', 'Backend Engineer', '2016-08-01', '2019-06-30', false, 1),
  -- 0003 Carla Mendes
  ('a1000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', 'linkedin', null, 'Freelance', 'Product Designer', '2021-02-01', null, true, 0),
  ('a1000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000003', 'linkedin', null, 'Swiggy', 'UX Designer', '2018-06-01', '2021-01-31', false, 1),
  -- 0004 David Kim
  ('a1000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000004', 'linkedin', null, 'Microsoft India', 'Machine Learning Engineer', '2020-04-01', null, true, 0),
  -- 0005 Emma Novak
  ('a1000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000005', 'linkedin', null, 'Meesho', 'Growth Lead', '2021-08-01', null, true, 0),
  ('a1000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000005', 'linkedin', null, 'Nykaa', 'Growth Manager', '2018-01-01', '2021-07-31', false, 1),
  -- 0006 Frank Delgado
  ('a1000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000006', 'linkedin', null, 'PhonePe', 'Mobile Engineer', '2019-05-01', null, true, 0),
  -- 0007 Grace Liu
  ('a1000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000007', 'linkedin', null, 'Flipkart', 'Senior Product Manager', '2020-01-01', null, true, 0),
  -- 0008 Henry Brown
  ('a1000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000008', 'linkedin', null, 'Delhivery', 'Head of Operations', '2017-09-01', null, true, 0),
  -- 0009 Isla Roth
  ('a1000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000009', 'linkedin', null, 'Independent', 'Brand Designer', '2022-01-01', null, true, 0),
  -- 000a John Park
  ('a1000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-00000000000a', 'linkedin', null, 'SkillBridge', 'Founder & CEO', '2023-06-01', null, true, 0),
  -- 000b Kate Sharma
  ('a1000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-00000000000b', 'linkedin', null, 'Sarvam AI', 'NLP Engineer', '2022-02-01', null, true, 0),
  -- 000c Leo Martins
  ('a1000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-00000000000c', 'linkedin', null, 'Zomato', 'Backend Engineer', '2019-09-01', null, true, 0),
  ('a1000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-00000000000c', 'linkedin', null, 'Postman', 'Backend Engineer', '2016-07-01', '2019-08-31', false, 1)
on conflict (id) do nothing;

-- ============================================================
-- 5. Candidate profile_education (bonus richness)
-- ============================================================
insert into public.profile_education
  (id, user_id, provider_external_id, school, degree, field_of_study, started_at, ended_at, is_current, sort_order, source)
values
  ('a2000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', null, 'VIT Vellore', 'B.Tech', 'Computer Science', '2013-07-01', '2017-06-30', false, 0, 'linkedin'),
  ('a2000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', null, 'IIT Bombay', 'B.Tech', 'Computer Science', '2012-07-01', '2016-05-31', false, 0, 'linkedin'),
  ('a2000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', null, 'BITS Pilani', 'B.Tech', 'Electrical & Electronics', '2014-08-01', '2018-07-31', false, 0, 'linkedin'),
  ('a2000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000b', null, 'Anna University', 'B.E.', 'Computer Science', '2013-07-01', '2017-05-31', false, 0, 'linkedin')
on conflict (id) do nothing;

-- EOF