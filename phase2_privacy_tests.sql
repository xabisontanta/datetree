-- ============================================================================
-- DataTree Phase 2 pgTAP tests: privacy, DTOs, slots, double-booking guard
-- Run with: npm run test:db   (supabase tests run as postgres; set local role
-- to exercise RLS exactly as PostgREST does.)
-- ============================================================================
begin;
select plan(14);

-- ---------------------------------------------------------------------------
-- Fixtures: creator (public) and stranger (authenticated non-creator)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'creator@datetree.test'),
       ('22222222-2222-2222-2222-222222222222', 'stranger@datetree.test')
on conflict (id) do nothing;

insert into public.profiles (id, username, is_public, category, timezone)
values ('11111111-1111-1111-1111-111111111111', 'democoach', true, 'fitness', 'Africa/Johannesburg'),
       ('22222222-2222-2222-2222-222222222222', 'privateguy', false, 'custom', 'UTC')
on conflict (id) do nothing;

insert into public.services (id, creator_id, title, duration_minutes, price_cents)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
        '1:1 Coaching Call', 60, 5000),
       ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
        'Paused Service', 30, null)
on conflict (id) do nothing;
update public.services set is_active = false where id = '44444444-4444-4444-4444-444444444444';

-- Weekly availability: Monday 2026-09-14 is a Monday; every weekday 09:00–17:00.
insert into public.availability_rules (creator_id, day_of_week, start_time, end_time)
select '11111111-1111-1111-1111-111111111111', d, time '09:00', time '17:00'
from generate_series(1, 5) as d;

-- ---------------------------------------------------------------------------
-- 1. Public DTO views
-- ---------------------------------------------------------------------------
set local role anon;

select is((select count(*) from public.public_creator_profiles
           where username = 'democoach'), 1::bigint,
          'public DTO shows public creator');
select is((select count(*) from public.public_creator_profiles
           where username = 'privateguy'), 0::bigint,
          'public DTO hides private creator');
select is((select count(*) from public.public_services
           where creator_username = 'democoach' and title = '1:1 Coaching Call'), 1::bigint,
          'public DTO shows active service');
select is((select count(*) from public.public_services
           where title = 'Paused Service'), 0::bigint,
          'public DTO hides paused service');

-- ---------------------------------------------------------------------------
-- 2. Raw-table privacy (the Phase 1 promise, kept)
-- ---------------------------------------------------------------------------
select is((select count(*) from public.booking_requests), 0::bigint,
          'anon cannot read booking_requests via RLS');
select is((select count(*) from public.booking_requests
           where creator_id = '11111111-1111-1111-1111-111111111111'), 0::bigint,
          'stranger cannot read creator booking_requests');

-- ---------------------------------------------------------------------------
-- 3. Slot generation
-- ---------------------------------------------------------------------------
select ok((select count(*) >= 7
           from public.generate_time_slots(
             '11111111-1111-1111-1111-111111111111', date '2026-09-14', 60)),
          'Monday yields 9:00–16:00 hourly slots');
select is((select count(*) from public.generate_time_slots(
             '11111111-1111-1111-1111-111111111111', date '2026-09-13', 60)), 0::bigint,
          'Sunday (no rule) yields no slots');

insert into public.blocked_dates (creator_id, date)
values ('11111111-1111-1111-1111-111111111111', date '2026-09-15');
select is((select count(*) from public.generate_time_slots(
             '11111111-1111-1111-1111-111111111111', date '2026-09-15', 60)), 0::bigint,
          'blocked date yields no slots');

-- ---------------------------------------------------------------------------
-- 4. Booking submission + double-booking guard
-- ---------------------------------------------------------------------------
select ok(exists(
    select 1 from public.submit_booking_request(
      '33333333-3333-3333-3333-333333333333', date '2026-09-14', time '10:00',
      'Test Client', 'client@example.com')),
    'valid submission succeeds');

select throws_ok(
    $$select public.submit_booking_request(
        '33333333-3333-3333-3333-333333333333', date '2026-09-14', time '10:00',
        'Second Client', 'second@example.com')$$,
    'time slot unavailable',
    'second overlapping request is rejected');

select throws_ok(
    $$select public.submit_booking_request(
        '33333333-3333-3333-3333-333333333333', date '2020-01-01', time '10:00',
        'Old Client', 'old@example.com')$$,
    'cannot book past dates',
    'past date rejected');

-- Creator sees own requests; stranger still cannot.
set local role authenticated;
select is((select count(*) from public.booking_requests), 0::bigint,
          'stranger still cannot read booking_requests');

set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111"}';
select is((select count(*) from public.booking_requests
           where creator_id = '11111111-1111-1111-1111-111111111111'), 1::bigint,
          'creator reads own booking_requests');

select finish();
rollback;
