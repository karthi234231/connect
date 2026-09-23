--- ============================================================
-- DB-08 GUARD — DEV DATA MUST NEVER REACH PRODUCTION.
-- This seed file contains fake users with plaintext passwords and
-- must NEVER run on a production database. The Supabase CLI guard
-- in config.toml ([db.seed] enabled = false, sql_paths = []) prevents
-- automatic seeding. This file is explicitly excluded from the migration
-- path (it lives in seeds/, not migrations/).
-- Violation = production data compromise (PII + auth bypass).
-- ============================================================
-- ============================================================
-- Connect - full seed (local dev)
-- 13 Indian professionals (incl. owner test account) with real
-- avatar photos, ideas, events, matches, messages, connections.
-- Passwords (local dev only): Password123! (jogi: his own).
-- ============================================================

-- Users ---------------------------------------------------------
insert into auth.users
  (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', 'arjun.mehta@connect.dev', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Arjun Mehta"}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'priya.nair@connect.dev', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Priya Nair"}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'rohan.iyer@connect.dev', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Rohan Iyer"}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'ananya.sharma@connect.dev', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Ananya Sharma"}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', 'vikram.desai@connect.dev', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Vikram Desai"}', now(), now()),
  ('00000000-0000-0000-0000-000000000006', 'sneha.kulkarni@connect.dev', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Sneha Kulkarni"}', now(), now()),
  ('00000000-0000-0000-0000-000000000007', 'aditya.rao@connect.dev', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Aditya Rao"}', now(), now()),
  ('00000000-0000-0000-0000-000000000008', 'meera.krishnan@connect.dev', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Meera Krishnan"}', now(), now()),
  ('00000000-0000-0000-0000-000000000009', 'karthik.reddy@connect.dev', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Karthik Reddy"}', now(), now()),
  ('00000000-0000-0000-0000-00000000000a', 'divya.menon@connect.dev', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Divya Menon"}', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', 'nikhil.joshi@connect.dev', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Nikhil Joshi"}', now(), now()),
  ('00000000-0000-0000-0000-00000000000c', 'ishita.bose@connect.dev', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Ishita Bose"}', now(), now()),
  ('00000000-0000-0000-0000-00000000000d', 'jogikarthik123@gmail.com', crypt('21pa1a0562@VISHNU', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Karthik Jogi"}', now(), now());



-- Profiles ------------------------------------------------------
insert into public.profiles
  (id, full_name, avatar_url, role, bio, timezone, commitment_level, work_style, visibility, skills, availability, looking_for, onboarding_status, onboarding_completed_at, last_active_at)
values
  ('00000000-0000-0000-0000-000000000001', 'Arjun Mehta', 'https://randomuser.me/api/portraits/men/32.jpg', 'founder', 'Fintech founder (pre-seed) in Bengaluru. Building UPI-first credit rails for gig workers. Looking for a founding engineer.', 'Asia/Kolkata', 'full_time', 'fast_iterate', 'public', '{fintech,product_management,ai}', '{"days":["mon","tue","wed","thu","fri"],"hours":{"start":"09:00","end":"19:00"}}', '{"roles":["engineer","data_ml"]}', 'completed', now(), now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000000002', 'Priya Nair', 'https://randomuser.me/api/portraits/women/44.jpg', 'engineer', 'Frontend engineer at a Series-A SaaS in Kochi. React, Next.js, design systems. Exploring early-stage startup gigs.', 'Asia/Kolkata', 'part_time', 'flexible', 'public', '{frontend,fullstack,ui}', '{"days":["mon","tue","wed","thu","fri"],"hours":{"start":"18:00","end":"22:00"}}', '{"roles":["founder","designer"]}', 'completed', now(), now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000003', 'Rohan Iyer', 'https://randomuser.me/api/portraits/men/45.jpg', 'engineer', 'Backend engineer (Go, Postgres, AWS). Ex-payments unicorn team. Want to build infra for Bharat.', 'Asia/Kolkata', 'nights_weekends', 'structured', 'public', '{backend,devops,security}', '{"days":["fri","sat","sun"],"hours":{"start":"19:00","end":"23:00"}}', '{"roles":["founder","engineer"]}', 'completed', now(), now() - interval '3 hours'),
  ('00000000-0000-0000-0000-000000000004', 'Ananya Sharma', 'https://randomuser.me/api/portraits/women/65.jpg', 'designer', 'Product designer in Pune. Fintech + healthtech. Systems thinker, Figma nerd. Open to 0-1 projects.', 'Asia/Kolkata', 'part_time', 'deliberate', 'recruiting', '{ux,product_design,user_research}', '{"days":["tue","wed","thu","sat"],"hours":{"start":"10:00","end":"18:00"}}', '{"roles":["founder","engineer","product"]}', 'completed', now(), now() - interval '5 hours'),
  ('00000000-0000-0000-0000-000000000005', 'Vikram Desai', 'https://randomuser.me/api/portraits/men/22.jpg', 'product', 'Senior PM in Mumbai. Marketplace and logistics domain. Building in public on weekends.', 'Asia/Kolkata', 'part_time', 'fast_iterate', 'public', '{product_management,marketplace,analytics}', '{"days":["sat","sun"],"hours":{"start":"10:00","end":"20:00"}}', '{"roles":["engineer","designer","growth"]}', 'completed', now(), now() - interval '26 hours'),
  ('00000000-0000-0000-0000-000000000006', 'Sneha Kulkarni', 'https://randomuser.me/api/portraits/women/68.jpg', 'growth', 'Growth lead at a D2C brand in Bengaluru. Performance marketing, SEO, retention loops.', 'Asia/Kolkata', 'full_time', 'flexible', 'public', '{marketing,growth,seo,content}', '{"days":["mon","tue","wed","thu","fri"],"hours":{"start":"09:30","end":"18:30"}}', '{"roles":["founder","product"]}', 'completed', now(), now() - interval '40 minutes'),
  ('00000000-0000-0000-0000-000000000007', 'Aditya Rao', 'https://randomuser.me/api/portraits/men/36.jpg', 'operations', 'Ops generalist. Scaled a logistics startup from 10-200 people. Compliance, vendor mgmt, unit economics.', 'Asia/Kolkata', 'full_time', 'structured', 'public', '{operations,finance,legal}', '{"days":["mon","tue","wed","thu","fri"],"hours":{"start":"09:00","end":"18:00"}}', '{"roles":["founder","growth"]}', 'completed', now(), now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000008', 'Meera Krishnan', 'https://randomuser.me/api/portraits/women/47.jpg', 'data_ml', 'ML engineer in Chennai. Recommendation systems, Indic NLP. Published at 2 tier-2 conferences.', 'Asia/Kolkata', 'part_time', 'deliberate', 'public', '{ml_ai,data,python,backend}', '{"days":["mon","wed","fri","sat"],"hours":{"start":"20:00","end":"23:00"}}', '{"roles":["founder","data_ml","engineer"]}', 'completed', now(), now() - interval '4 days'),
  ('00000000-0000-0000-0000-000000000009', 'Karthik Reddy', 'https://randomuser.me/api/portraits/men/54.jpg', 'founder', 'Edtech founder in Hyderabad. Vernacular upskilling for tier-2/3 students. 8k MAU, raising angel round.', 'Asia/Kolkata', 'full_time', 'fast_iterate', 'recruiting', '{edtech,product_management,growth}', '{"days":["mon","tue","wed","thu","fri","sat"],"hours":{"start":"08:00","end":"21:00"}}', '{"roles":["engineer","designer","growth","operations"]}', 'completed', now(), now() - interval '20 minutes'),
  ('00000000-0000-0000-0000-00000000000a', 'Divya Menon', 'https://randomuser.me/api/portraits/women/26.jpg', 'designer', 'Brand + product designer from Chennai. Helps startups look fundable. Illustration, motion, webflow.', 'Asia/Kolkata', 'nights_weekends', 'flexible', 'public', '{ui,branding,illustration,ux}', '{"days":["sat","sun"],"hours":{"start":"11:00","end":"20:00"}}', '{"roles":["founder","engineer"]}', 'completed', now(), now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000000000b', 'Nikhil Joshi', 'https://randomuser.me/api/portraits/men/71.jpg', 'engineer', 'Mobile engineer (React Native, Kotlin) in Mumbai. Shipped 4 consumer apps. Curious about offline-first India.', 'Asia/Kolkata', 'part_time', 'structured', 'public', '{mobile,frontend,fullstack}', '{"days":["mon","wed","thu","sat"],"hours":{"start":"19:00","end":"23:00"}}', '{"roles":["founder","designer"]}', 'completed', now(), now() - interval '8 hours'),
  ('00000000-0000-0000-0000-00000000000c', 'Ishita Bose', 'https://randomuser.me/api/portraits/women/57.jpg', 'product', 'Product lead in Delhi. B2B SaaS pricing, onboarding, PLG. Stealth-mode idea in climate logistics.', 'Asia/Kolkata', 'part_time', 'deliberate', 'stealth', '{product_management,b2b,pricing}', '{"days":["tue","thu","sun"],"hours":{"start":"20:00","end":"23:00"}}', '{"roles":["engineer","data_ml","operations"]}', 'completed', now(), now() - interval '6 days'),
  ('00000000-0000-0000-0000-00000000000d', 'Karthik Jogi', 'https://media.licdn.com/dms/image/v2/D4D03AQFX3e4m6KWRlQ/profile-displayphoto-scale_400_400/B4DZ_3JWpQIIAg-/0/1786557853172?e=1790208000&v=beta&t=NKPs9yEs019SlOFLD8tixDxs4fCLuUIv7mKgq585Z2Y', 'founder', 'Building with Connect - looking for engineers and designers to collaborate with.', 'Asia/Kolkata', 'full_time', 'flexible', 'public', '{product_management,backend,growth}', '{"days":["mon","tue","wed","thu","fri","sat"],"hours":{"start":"09:00","end":"21:00"}}', '{"roles":["engineer","designer","founder","growth"]}', 'completed', now(), now() - interval '10 minutes');

-- user_skills ---------------------------------------------------
insert into public.user_skills (user_id, skill, proficiency)
values
  ('00000000-0000-0000-0000-000000000001', 'fintech', 5),
  ('00000000-0000-0000-0000-000000000001', 'product_management', 4),
  ('00000000-0000-0000-0000-000000000001', 'ai', 3),
  ('00000000-0000-0000-0000-000000000002', 'frontend', 5),
  ('00000000-0000-0000-0000-000000000002', 'ui', 4),
  ('00000000-0000-0000-0000-000000000002', 'fullstack', 4),
  ('00000000-0000-0000-0000-000000000003', 'backend', 5),
  ('00000000-0000-0000-0000-000000000003', 'devops', 4),
  ('00000000-0000-0000-0000-000000000003', 'security', 4),
  ('00000000-0000-0000-0000-000000000004', 'ux', 5),
  ('00000000-0000-0000-0000-000000000004', 'product_design', 5),
  ('00000000-0000-0000-0000-000000000005', 'product_management', 5),
  ('00000000-0000-0000-0000-000000000005', 'marketplace', 4),
  ('00000000-0000-0000-0000-000000000006', 'growth', 5),
  ('00000000-0000-0000-0000-000000000006', 'marketing', 4),
  ('00000000-0000-0000-0000-000000000007', 'operations', 5),
  ('00000000-0000-0000-0000-000000000007', 'finance', 4),
  ('00000000-0000-0000-0000-000000000008', 'ml_ai', 5),
  ('00000000-0000-0000-0000-000000000008', 'data', 5),
  ('00000000-0000-0000-0000-000000000009', 'edtech', 5),
  ('00000000-0000-0000-0000-000000000009', 'growth', 4),
  ('00000000-0000-0000-0000-00000000000a', 'ui', 5),
  ('00000000-0000-0000-0000-00000000000a', 'branding', 4),
  ('00000000-0000-0000-0000-00000000000b', 'mobile', 5),
  ('00000000-0000-0000-0000-00000000000b', 'frontend', 4),
  ('00000000-0000-0000-0000-00000000000c', 'product_management', 5),
  ('00000000-0000-0000-0000-00000000000c', 'pricing', 4),
  ('00000000-0000-0000-0000-00000000000d', 'product_management', 4),
  ('00000000-0000-0000-0000-00000000000d', 'backend', 3),
  ('00000000-0000-0000-0000-00000000000d', 'growth', 4);

-- Matches --------------------------------------------------------
insert into public.matches (id, user1_id, user2_id, status, score, created_at, updated_at)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000d', 'active', 87, now() - interval '3 days', now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', 'active', 74, now() - interval '2 days', now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000d', 'pending', 68, now() - interval '6 hours', now() - interval '6 hours'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'active', 91, now() - interval '4 days', now() - interval '3 days'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000008', 'pending', 77, now() - interval '1 day', now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'active', 71, now() - interval '2 days', now() - interval '2 days'),
  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-00000000000a', 'active', 69, now() - interval '3 days', now() - interval '2 days'),
  ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', 'pending', 63, now() - interval '10 hours', now() - interval '10 hours');

-- Messages (keyset order by created_at) --------------------------
insert into public.messages (id, match_id, sender_id, content, client_message_id, read_at, created_at)
values
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Hey! Saw your profile - what are you building?', gen_random_uuid(), now() - interval '2 days', now() - interval '2 days'),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'A founder-matching platform actually, this one - want to pair on the matching engine?', gen_random_uuid(), now() - interval '2 days', now() - interval '2 days' + interval '1 hour'),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Ha, meta. I''m in - evenings and weekends work.', gen_random_uuid(), now() - interval '1 day', now() - interval '1 day'),
  ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'Great, I''ll set up a call this week.', gen_random_uuid(), now() - interval '20 hours', now() - interval '20 hours'),
  ('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Hi! Frontend here. Your React + design systems post caught my eye.', gen_random_uuid(), now() - interval '1 day', now() - interval '1 day'),
  ('21000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', 'Awesome - want to take the discover page?', gen_random_uuid(), now() - interval '22 hours', now() - interval '22 hours'),
  ('21000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Yes, sending a PR this weekend.', gen_random_uuid(), now() - interval '18 hours', now() - interval '18 hours'),
  ('21000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000d', 'Loved your fintech case study. Open to a quick chat?', gen_random_uuid(), now() - interval '5 hours', now() - interval '5 hours'),
  ('21000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Looking for a founding engineer - payments background a huge plus.', gen_random_uuid(), now() - interval '3 days', now() - interval '3 days'),
  ('21000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'Interesting. UPI rails for gig workers is a real problem. Let''s talk.', gen_random_uuid(), now() - interval '3 days', now() - interval '3 days' + interval '2 hours'),
  ('21000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000b', 'Design systems duo - I''m mobile side. Coffee chat?', gen_random_uuid(), now() - interval '1 day', now() - interval '1 day'),
  ('21000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-00000000000a', 'Happy to help make the app look fundable.', gen_random_uuid(), null, now() - interval '2 days');

-- Connection requests --------------------------------------------
insert into public.connection_requests (id, requester_id, addressee_id, status, message, created_at, updated_at)
values
  ('22000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000006', 'pending', 'Would love your growth brain for my project.', now() - interval '2 days', now() - interval '2 days'),
  ('22000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-00000000000d', 'accepted', 'Met at ML office hours.', now() - interval '9 days', now() - interval '8 days'),
  ('22000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'pending', 'Your gig-worker credit idea overlaps with my marketplace work.', now() - interval '1 day', now() - interval '1 day'),
  ('22000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000009', 'accepted', 'Happy to help with your angel round data room.', now() - interval '5 days', now() - interval '4 days'),
  ('22000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000d', 'pending', 'Saw your idea - I can do the brand.', now() - interval '8 hours', now() - interval '8 hours'),
  ('22000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000003', 'accepted', 'Fellow backend nerd, hello.', now() - interval '6 days', now() - interval '6 days');

-- Blocks / Reports ------------------------------------------------
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000005');

insert into public.reports (id, reporter_id, reported_id, reason, note, status, created_at) values
  ('24000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000005', 'spam', 'Sending repeated promo links in DMs.', 'open', now() - interval '1 day'),
  ('24000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'harassment', 'Pushy follow-ups after being asked to stop.', 'actioned', now() - interval '4 days');

-- Ideas -----------------------------------------------------------
insert into public.ideas (id, owner_id, title, problem, solution, ask, stage, team_needed, tags, visibility, join_enabled, validation_count, image_url, created_at, updated_at)
values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'Connect - cofounder matching for Indian builders', 'Skilled people in India rarely meet the right cofounder outside their own circle.', 'Rule-based, explainable matching with warm intros and built-in chat.', 'A founding engineer to own the matching engine.', 'mvp', '{engineer,designer}', '{community,matching,saas}', 'published', true, 12, 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800', now() - interval '20 days', now() - interval '2 days'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'PaisaSetu - UPI credit rails for gig workers', 'Gig workers get paid weekly but credit scoring treats them like they have no income.', 'Cash-flow underwriting on top of UPI transaction streams.', 'ML engineer + 1 backend intern.', 'prototype', '{engineer,data_ml}', '{fintech,upi,lending}', 'published', true, 8, 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800', now() - interval '15 days', now() - interval '3 days'),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000009', 'SkillSetu - vernacular upskilling for tier-2/3 colleges', 'Great courses exist only in English and cost more than a month of pocket money.', 'Bite-sized Telugu/Hindi courses with placement-linked pricing.', 'Mobile engineer to own the React Native app.', 'mvp', '{engineer,growth}', '{edtech,mobile,vernacular}', 'published', true, 21, 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800', now() - interval '40 days', now() - interval '1 day'),
  ('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008', 'Saheli AI - Indic mental-health companion', 'Therapy is unaffordable and stigmatized; no companion speaks Tamil the way friends do.', 'Voice-first companion fine-tuned for Indic languages with safety guardrails.', 'A designer and a clinical advisor.', 'idea', '{ml_ai,designer}', '{ai,health,nlp}', 'draft', false, 0, 'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=800', now() - interval '6 days', now() - interval '6 days'),
  ('50000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', 'GrowthOS - retention playbooks for D2C brands', 'D2C founders burn ad money with no systematic retention layer.', 'Plug-and-play WhatsApp + email playbooks with benchmark data.', 'Fullstack engineer to build the Shopify integration.', 'prototype', '{engineer,product}', '{growth,saas,d2c}', 'published', true, 5, 'https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=800', now() - interval '12 days', now() - interval '4 days'),
  ('50000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000005', 'FreightKart - spot marketplace for trucks', 'Trucks return empty 40% of the time; brokers take 15% for a WhatsApp group.', 'Auction-style spot marketplace with FASTag-verified tracking.', 'Founding engineer + ops lead.', 'idea', '{engineer,operations}', '{logistics,marketplace}', 'published', false, 3, 'https://images.pexels.com/photos/210607/pexels-photo-210607.jpeg?auto=compress&cs=tinysrgb&w=800', now() - interval '8 days', now() - interval '5 days'),
  ('50000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000004', 'CareCircle - family health tracker', 'Managing parents'' prescriptions across cities is chaos over WhatsApp.', 'Shared family timeline for meds, vitals and doctor visits with reminders.', 'React Native engineer.', 'prototype', '{engineer}', '{healthtech,mobile,family}', 'published', true, 9, 'https://images.pexels.com/photos/265087/pexels-photo-265087.jpeg?auto=compress&cs=tinysrgb&w=800', now() - interval '18 days', now() - interval '2 days'),
  ('50000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-00000000000c', 'Project stealth - climate logistics optimizer', 'Freight emissions are unmeasured and unpriced in India.', 'Talking to 20 shippers before writing code. More soon.', 'A data engineer who loves maps.', 'idea', '{data_ml,operations}', '{climate,b2b}', 'draft', false, 0, 'https://images.pexels.com/photos/590016/pexels-photo-590016.jpeg?auto=compress&cs=tinysrgb&w=800', now() - interval '3 days', now() - interval '3 days');

-- team_memberships ------------------------------------------------
insert into public.team_memberships (id, idea_id, user_id, role) values
  ('51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Founding Engineer'),
  ('51000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Frontend Engineer'),
  ('51000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000008', 'ML Engineer'),
  ('51000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', 'Mobile Engineer'),
  ('51000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'Brand Designer');

-- join_requests ----------------------------------------------------
insert into public.join_requests (id, idea_id, user_id, status, message, created_at, updated_at) values
  ('52000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'pending', 'I''ve built UPI integrations before - happy to help.', now() - interval '2 days', now() - interval '2 days'),
  ('52000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'pending', 'Love the vision. I can own product design.', now() - interval '1 day', now() - interval '1 day'),
  ('52000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000007', 'approved', 'Can run college partnerships in AP/TS.', now() - interval '10 days', now() - interval '9 days');

-- idea_interests ---------------------------------------------------
insert into public.idea_interests (id, idea_id, user_id, action, created_at) values
  ('52500000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', 'like', now() - interval '2 days'),
  ('52500000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-00000000000d', 'like', now() - interval '3 days'),
  ('52500000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'spark', now() - interval '1 day');

-- Events -----------------------------------------------------------
insert into public.events
  (id, organizer_id, title, description, type, format, location_or_link, starts_at, duration_minutes, capacity, tags, recurrence, status, visibility, category, timezone, price, currency, registration_open, published_at, created_at, updated_at)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'Bangalore Builders Meetup', 'Monthly IRL meetup for founders, engineers and designers. Chai, lightning talks and open networking.', 'irl', 'social', 'WeWork Galaxy, Residency Road, Bengaluru', now() + interval '7 days', 180, 50, '["founders","networking","startups"]', 'monthly', 'published', 'public', 'networking', 'Asia/Kolkata', 0, 'INR', true, now(), now() - interval '10 days', now()),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Intro to React Server Components', 'Hands-on workshop: RSC fundamentals, streaming and common migration traps.', 'virtual', 'workshop', 'https://meet.google.com/rsc-intro-workshop', now() + interval '3 days', 90, 100, '["react","frontend","nextjs"]', 'none', 'published', 'public', 'technology', 'Asia/Kolkata', 0, 'INR', true, now(), now() - interval '6 days', now()),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Fintech Founder Coffee Chat', 'Small-table coffee for pre-seed fintech founders. 8 seats, real conversations.', 'irl', 'coffee', 'Third Wave Coffee, Koramangala, Bengaluru', now() + interval '5 days', 60, 8, '["fintech","coffee","founders"]', 'none', 'published', 'public', 'business', 'Asia/Kolkata', 0, 'INR', true, now(), now() - interval '4 days', now()),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008', 'ML Office Hours India', 'Open office hours for ML questions. Bring your model problems.', 'virtual', 'office_hours', 'https://meet.google.com/ml-office-hours-in', now() + interval '2 days', 90, 15, '["ml","ai","data"]', 'weekly', 'published', 'public', 'technology', 'Asia/Kolkata', 0, 'INR', true, now(), now() - interval '8 days', now()),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', '48-hour Growth Challenge', 'Ship a landing page + cold email sequence in 48 hours. Teams of 3.', 'virtual', 'challenge', 'https://meet.google.com/growth-challenge-48', now() + interval '10 days', 240, 25, '["growth","marketing"]', 'none', 'published', 'public', 'business', 'Asia/Kolkata', 0, 'INR', true, now(), now() - interval '5 days', now()),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000009', 'Hyderabad Founder Social', 'Rooftop social for founders and operators. Monthly, hosted by SkillSetu.', 'irl', 'social', 'Dice House Rooftop, Hitec City, Hyderabad', now() + interval '14 days', 120, 40, '["founders","networking"]', 'monthly', 'published', 'public', 'networking', 'Asia/Kolkata', 0, 'INR', true, now(), now() - interval '7 days', now()),
  ('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-00000000000a', 'Design Systems Workshop', 'Tokens, component APIs and theming. Bring your Figma.', 'virtual', 'workshop', 'https://meet.google.com/design-systems-ws', now() + interval '6 days', 120, 30, '["design","ui","figma"]', 'none', 'published', 'public', 'design', 'Asia/Kolkata', 0, 'INR', true, now(), now() - interval '3 days', now()),
  ('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000007', 'Startup Ops AMA', 'Ask-me-anything on compliance, vendor management and unit economics.', 'virtual', 'office_hours', 'https://meet.google.com/ops-ama', now() + interval '4 days', 60, 20, '["operations","ama"]', 'none', 'published', 'public', 'business', 'Asia/Kolkata', 0, 'INR', true, now(), now() - interval '2 days', now());

-- event_groups ------------------------------------------------------
insert into public.event_groups (id, event_id, label, capacity, created_at) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Table A', 6, now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Table B', 6, now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000006', 'Group 1', 10, now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000006', 'Group 2', 10, now() - interval '1 day');

-- event_attendees ---------------------------------------------------
insert into public.event_attendees (event_id, user_id, status, group_id, created_at) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'going', '40000000-0000-0000-0000-000000000001', now() - interval '9 days'),
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'going', '40000000-0000-0000-0000-000000000001', now() - interval '8 days'),
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'going', '40000000-0000-0000-0000-000000000002', now() - interval '7 days'),
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'going', '40000000-0000-0000-0000-000000000002', now() - interval '6 days'),
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000008', 'going', '40000000-0000-0000-0000-000000000001', now() - interval '5 days'),
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'going', '40000000-0000-0000-0000-000000000002', now() - interval '4 days'),
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'waitlisted', null, now() - interval '6 hours'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'going', null, now() - interval '6 days'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', 'going', null, now() - interval '5 days'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'going', null, now() - interval '4 days'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'going', null, now() - interval '3 days'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'going', null, now() - interval '4 days'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'going', null, now() - interval '3 days'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000006', 'going', null, now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008', 'going', null, now() - interval '7 days'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000d', 'going', null, now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000c', 'going', null, now() - interval '1 day'),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', 'going', null, now() - interval '5 days'),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', 'going', null, now() - interval '4 days'),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000007', 'going', null, now() - interval '3 days'),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000009', 'going', null, now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000009', 'going', '40000000-0000-0000-0000-000000000003', now() - interval '7 days'),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000a', 'going', '40000000-0000-0000-0000-000000000003', now() - interval '6 days'),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000007', 'going', '40000000-0000-0000-0000-000000000004', now() - interval '5 days'),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000b', 'going', '40000000-0000-0000-0000-000000000004', now() - interval '4 days'),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000c', 'going', null, now() - interval '3 days'),
  ('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-00000000000a', 'going', null, now() - interval '3 days'),
  ('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000004', 'going', null, now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 'going', null, now() - interval '1 day'),
  ('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000007', 'going', null, now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000005', 'going', null, now() - interval '1 day'),
  ('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-00000000000d', 'going', null, now() - interval '20 hours');

-- event_registrations ------------------------------------------------
insert into public.event_registrations (id, event_id, user_id, status, registered_at, waitlist_position) values
  ('45000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'registered', now() - interval '9 days', null),
  ('45000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'registered', now() - interval '8 days', null),
  ('45000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'waitlisted', now() - interval '6 hours', 1),
  ('45000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', 'registered', now() - interval '5 days', null),
  ('45000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'registered', now() - interval '4 days', null),
  ('45000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000009', 'registered', now() - interval '7 days', null);

-- event_agenda --------------------------------------------------------
insert into public.event_agenda (id, event_id, title, description, starts_at, duration_minutes, sort_order) values
  ('46000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Doors open + chai', 'Badge pickup and informal networking.', now() + interval '7 days', 15, 0),
  ('46000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Founder lightning talks', '5 founders - 10 minutes each: what broke and what worked.', now() + interval '7 days' + interval '15 minutes', 60, 1),
  ('46000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'Open networking', 'Table topics + warm intro rounds.', now() + interval '7 days' + interval '75 minutes', 105, 2),
  ('46000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'RSC fundamentals', 'Server/client boundary, streaming, caching.', now() + interval '3 days', 45, 0),
  ('46000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 'Live refactor Q&A', 'Refactoring a real page to RSC live.', now() + interval '3 days' + interval '45 minutes', 45, 1),
  ('46000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000007', 'Tokens & theming', 'Design tokens from Figma to CSS variables.', now() + interval '6 days', 60, 0),
  ('46000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000007', 'Component API design', 'Props, slots and composition patterns.', now() + interval '6 days' + interval '60 minutes', 60, 1);

-- event_speakers -------------------------------------------------------
insert into public.event_speakers (id, event_id, name, role, company, avatar_url, bio, sort_order) values
  ('47000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Priya Nair', 'Frontend Engineer', 'Kochi SaaS', 'https://randomuser.me/api/portraits/women/44.jpg', 'Design systems and Next.js at scale.', 0),
  ('47000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Arjun Mehta', 'Founder', 'PaisaSetu', 'https://randomuser.me/api/portraits/men/32.jpg', 'From PM to fintech founder in 12 months.', 1),
  ('47000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'Priya Nair', 'Instructor', 'Connect', 'https://randomuser.me/api/portraits/women/44.jpg', 'RSC in production since day one.', 0),
  ('47000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000007', 'Divya Menon', 'Brand Designer', 'Independent', 'https://randomuser.me/api/portraits/women/26.jpg', 'Makes startups look fundable.', 0),
  ('47000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000007', 'Ananya Sharma', 'Product Designer', 'Independent', 'https://randomuser.me/api/portraits/women/65.jpg', 'Systems thinking for 0-1 products.', 1);

-- event_media ----------------------------------------------------------
insert into public.event_media (id, event_id, type, url, title, description, mime_type, is_public, allow_download, sort_order) values
  ('48000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'image', 'https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg?auto=compress&cs=tinysrgb&w=800', 'Last meetup crowd', 'August edition at WeWork Galaxy.', 'image/jpeg', true, false, 0),
  ('48000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'image', 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=800', 'Lightning talks', 'Founders on stage.', 'image/jpeg', true, false, 1),
  ('48000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000007', 'image', 'https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=800', 'Design workshop', 'Sketching component APIs.', 'image/jpeg', true, false, 0),
  ('48000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000006', 'image', 'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=800', 'Founder social', 'Rooftop edition.', 'image/jpeg', true, false, 0);

-- Notifications -------------------------------------------------------
insert into public.notifications (id, user_id, type, entity_type, entity_id, title, body, read_at, created_at) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'match_created', 'match', '20000000-0000-0000-0000-000000000001', 'You matched with Rohan Iyer', 'You both build backend-heavy products. Say hi!', now() - interval '2 days', now() - interval '3 days'),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', 'message_received', 'match', '20000000-0000-0000-0000-000000000001', 'Rohan Iyer sent you a message', 'Ha, meta. I''m in - evenings and weekends work.', null, now() - interval '1 day'),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000d', 'intro_requested', 'match', '20000000-0000-0000-0000-000000000003', 'Ananya Sharma wants an intro', 'She''s open to 0-1 design work.', null, now() - interval '5 hours'),
  ('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000d', 'event_reminder', 'event', '30000000-0000-0000-0000-000000000001', 'Bangalore Builders Meetup is in 7 days', 'You''re going. Venue: WeWork Galaxy, Residency Road.', now() - interval '1 hour', now() - interval '2 hours'),
  ('60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'message_received', 'match', '20000000-0000-0000-0000-000000000002', 'Jogi Karthik sent you a message', 'Awesome - want to take the discover page?', null, now() - interval '22 hours'),
  ('60000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', 'match_created', 'match', '20000000-0000-0000-0000-000000000001', 'You matched with Jogi Karthik', '86% match. Founder looking for a founding engineer.', now() - interval '2 days', now() - interval '3 days'),
  ('60000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'match_created', 'match', '20000000-0000-0000-0000-000000000004', 'You matched with Rohan Iyer', 'Payments background + UPI project. Strong fit.', now() - interval '3 days', now() - interval '4 days'),
  ('60000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000009', 'event_reminder', 'event', '30000000-0000-0000-0000-000000000006', 'Hyderabad Founder Social is in 14 days', 'You''re hosting. 40 seats.', null, now() - interval '3 hours');

-- notification_preferences (jogi) --------------------------------------
insert into public.notification_preferences (id, user_id, type, in_app, email, push) values
  ('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'match_created', true, true, false),
  ('61000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', 'message_received', true, true, true),
  ('61000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000d', 'event_reminder', true, false, true);

-- notification_settings -------------------------------------------------
insert into public.notification_settings (user_id, quiet_hours_enabled, digest_cadence, digest_hour, digest_timezone, security_alerts) values
  ('00000000-0000-0000-0000-00000000000d', false, 'daily', 9, 'Asia/Kolkata', true),
  ('00000000-0000-0000-0000-000000000002', false, 'daily', 9, 'Asia/Kolkata', true),
  ('00000000-0000-0000-0000-000000000001', false, 'weekly', 10, 'Asia/Kolkata', true);

-- Recommendations (jogi's stack) -----------------------------------------
insert into public.recommendations (id, user_id, candidate_id, score, action, reasons, breakdown, created_at, expires_at) values
  ('62000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000003', 87, 'like', '["shared_skill:backend","timezone:Asia/Kolkata","role_fit:engineer"]', '{"skill":25,"intent":20,"role":18,"availability":12,"activity":7,"timezone":5}', now() - interval '2 days', now() + interval '5 days'),
  ('62000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000002', 74, 'like', '["shared_skill:frontend","timezone:Asia/Kolkata"]', '{"skill":22,"intent":18,"role":14,"availability":8,"activity":6,"timezone":6}', now() - interval '2 days', now() + interval '5 days'),
  ('62000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000008', 71, 'like', '["looking_for:founder","timezone:Asia/Kolkata"]', '{"skill":20,"intent":16,"role":14,"availability":7,"activity":6,"timezone":8}', now() - interval '1 day', now() + interval '6 days'),
  ('62000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000005', 58, 'pass', '["availability:weekends_only"]', '{"skill":14,"intent":12,"role":10,"availability":4,"activity":5,"timezone":13}', now() - interval '1 day', now() + interval '6 days');

-- Feedback / Export requests / Alerts -------------------------------------
insert into public.feedback (id, user_id, context, message, created_at) values
  ('63000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'dashboard', 'Matching feels accurate but the profile edit flow is confusing.', now() - interval '3 days'),
  ('63000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'events', 'Love the events page. Would be great to add calendar export.', now() - interval '1 day');

insert into public.export_requests (id, user_id, status, created_at) values
  ('64000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'pending', now() - interval '1 day');

insert into public.alerts (id, user_id, severity, source, title, body, link, is_security, created_at) values
  ('65000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'info', 'system', 'Welcome to Connect', 'Complete your profile to get better matches.', '/dashboard/profile', false, now() - interval '20 days');

-- matching_weights (defaults, sum=100) -------------------------------------
insert into public.matching_weights (skill, intent, role, availability, activity, timezone, diversity, updated_by, updated_at)
values (25, 20, 18, 15, 12, 10, 0, '00000000-0000-0000-0000-00000000000d', now());

update auth.users set role = 'authenticated', aud = 'authenticated' where role is null or role = '';

-- GoTrue compatibility (raw inserts need these defaults) ---------
update auth.users
set instance_id = '00000000-0000-0000-0000-000000000000',
    role = 'authenticated',
    aud = 'authenticated',
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change_token_current = '',
    email_change = '',
    phone_change = '',
    phone_change_token = '',
    reauthentication_token = ''
where instance_id is null or instance_id::text = '';

insert into auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, 'email', u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');
