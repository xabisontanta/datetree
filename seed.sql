-- ============================================================================
-- DataTree Phase 2 seed: one demo creator per major category.
-- Requires the Phase 2 migration applied. Adjust column names here if Phase 1
-- named profile columns differently (see INTEGRATION.md).
-- ============================================================================

-- Demo auth users (password: 'password' — local dev only)
insert into auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'dating@demo.datetree', crypt('password', gen_salt('bf')), 'authenticated', 'authenticated', now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'fitness@demo.datetree', crypt('password', gen_salt('bf')), 'authenticated', 'authenticated', now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'lifecoach@demo.datetree', crypt('password', gen_salt('bf')), 'authenticated', 'authenticated', now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'business@demo.datetree', crypt('password', gen_salt('bf')), 'authenticated', 'authenticated', now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
   'shoutout@demo.datetree', crypt('password', gen_salt('bf')), 'authenticated', 'authenticated', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username, display_name, bio, is_public, category, timezone, booking_buffer_minutes)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'demodating',   'Alex — Dating Coach',  'Helping you show up confidently on every first date.', true, 'dating',      'Africa/Johannesburg', 15),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'demofitness',  'Sam — Fitness Coach',  '1:1 training and nutrition plans that fit your life.', true, 'fitness',     'Africa/Johannesburg', 10),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'demolifecoach','Ria — Life Coach',     'Clarity, goals, and accountability — one call at a time.', true, 'life_coaching', 'UTC', 15),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'demobusiness', 'Lee — Business Advisor','Strategy sessions for early-stage founders.',           true, 'business',    'UTC', 30),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'demoshoutout', 'Zee — Creator',        'Personalised birthday shout-outs within 48 hours.',     true, 'shout_out',   'UTC', 0)
on conflict (id) do nothing;

insert into public.services (creator_id, title, description, price_cents, duration_minutes, category, sort_order)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Date Prep Call',       'Plan the perfect first date.',        25000, 45, 'dating', 1),
  ('aaaaaaaa-0000-0000-0000-000000000002', '1:1 Training Session', 'Live video workout, form checked.',   40000, 60, 'fitness', 1),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Nutrition Plan Review','Review your plan and adjust macros.', 20000, 30, 'fitness', 2),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Discovery Call',       'Free 20-minute intro session.',       null,  20, 'life_coaching', 1),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Goal Setting Session', '90 days of focus, mapped out.',       60000, 60, 'life_coaching', 2),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Founder Strategy Hour','Deep-dive on your biggest blocker.',  120000, 60, 'business', 1),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Birthday Shout-out',   'Personalised 60s video shout-out.',   15000, 15, 'shout_out', 1);

-- Availability: weekdays 09:00–17:00 for every demo creator
insert into public.availability_rules (creator_id, day_of_week, start_time, end_time)
select p.id, d, time '09:00', time '17:00'
from public.profiles p,
     generate_series(1, 5) as d
where p.id in ('aaaaaaaa-0000-0000-0000-000000000001',
               'aaaaaaaa-0000-0000-0000-000000000002',
               'aaaaaaaa-0000-0000-0000-000000000003',
               'aaaaaaaa-0000-0000-0000-000000000004',
               'aaaaaaaa-0000-0000-0000-000000000005');

-- One sample pending request on the dating demo creator (next Monday 10:00)
insert into public.booking_requests (service_id, creator_id, client_name, client_email, requested_date, requested_start, requested_end, duration_minutes, status)
select s.id, s.creator_id, 'Seed Visitor', 'visitor@example.com',
       (date_trunc('week', now()) + interval '8 days')::date,
       ((date_trunc('week', now()) + interval '8 days')::date + time '10:00') at time zone 'Africa/Johannesburg',
       ((date_trunc('week', now()) + interval '8 days')::date + time '10:00') at time zone 'Africa/Johannesburg' + interval '45 minutes',
       s.duration_minutes, 'pending'
from public.services s
where s.title = 'Date Prep Call';
