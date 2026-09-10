-- ============================================================================
-- DataTree Phase 2: Multi-vertical services, availability & booking requests
-- ============================================================================
-- ASSUMPTIONS (reconcile with Phase 1 migrations before applying — see
-- INTEGRATION.md). Phase 1 is believed to provide:
--   * public.profiles (id uuid pk references auth.users(id), is_public boolean)
--   * public reads only via DTOs/views (no direct table grants to anon)
--
-- This migration adds:
--   * profile columns: username, bio, avatar_url, wall_url, theme, category,
--     timezone, booking_buffer_minutes
--   * tables: services, availability_rules, blocked_dates, booking_requests,
--     analytics_events  (all RLS-enabled)
--   * exclusion constraint preventing overlapping pending/accepted bookings
--   * public DTO views + slot-generation & booking-submission RPCs
-- ============================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.service_category as enum
  ('dating', 'fitness', 'life_coaching', 'business', 'shout_out', 'custom');

create type public.booking_status as enum
  ('pending', 'accepted', 'declined', 'cancelled');

-- ---------------------------------------------------------------------------
-- Profile extensions (defensive: no-op if Phase 1 already added a column)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists wall_url text,
  add column if not exists theme jsonb not null default '{"preset":"default"}'::jsonb,
  add column if not exists category public.service_category not null default 'custom',
  add column if not exists timezone text not null default 'UTC',
  add column if not exists booking_buffer_minutes int not null default 0
    check (booking_buffer_minutes >= 0);

-- Unique, reserved-safe usernames. Reserved words enforced in app layer too.
create unique index if not exists profiles_username_key on public.profiles (username);
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.profiles(id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 1 and 120),
  description      text,
  price_cents      bigint check (price_cents is null or price_cents >= 0),
  duration_minutes int  not null check (duration_minutes between 5 and 1440),
  category         public.service_category not null default 'custom',
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists services_creator_idx on public.services (creator_id, sort_order);

-- ---------------------------------------------------------------------------
-- Availability
-- ---------------------------------------------------------------------------
create table public.availability_rules (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time)
);

create index if not exists availability_creator_idx
  on public.availability_rules (creator_id, day_of_week);

create table public.blocked_dates (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  date       date not null,
  unique (creator_id, date)
);

-- ---------------------------------------------------------------------------
-- Booking requests
-- ---------------------------------------------------------------------------
create table public.booking_requests (
  id               uuid primary key default gen_random_uuid(),
  service_id       uuid not null references public.services(id) on delete cascade,
  creator_id       uuid not null references public.profiles(id) on delete cascade,
  client_name      text not null,
  client_email     text not null,
  client_phone     text,
  requested_date   date not null,           -- creator-local date (display)
  requested_start  timestamptz not null,    -- absolute instant (conflict detection)
  requested_end    timestamptz not null,
  duration_minutes int  not null,
  note             text,
  status           public.booking_status not null default 'pending',
  created_at       timestamptz not null default now(),
  check (requested_end > requested_start)
);

-- Hard guarantee: no overlapping pending/accepted bookings per creator.
alter table public.booking_requests add constraint booking_no_overlap
  exclude using gist (
    creator_id with =,
    tstzrange(requested_start, requested_end) with &&
  ) where (status in ('pending', 'accepted'));

create index if not exists booking_requests_creator_idx
  on public.booking_requests (creator_id, status, requested_start);

-- ---------------------------------------------------------------------------
-- Lightweight analytics
-- ---------------------------------------------------------------------------
create table public.analytics_events (
  id         bigint generated always as identity primary key,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('profile_view', 'link_click')),
  created_at timestamptz not null default now()
);

create index if not exists analytics_creator_idx
  on public.analytics_events (creator_id, type, created_at);

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.services enable row level security;
alter table public.availability_rules enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.booking_requests enable row level security;
alter table public.analytics_events enable row level security;

-- Services: public can see active services of public profiles (via DTO view
-- below); owner has full CRUD.
create policy services_select on public.services for select
  using (is_active and exists (
    select 1 from public.profiles p where p.id = creator_id and p.is_public)
  or auth.uid() = creator_id);
create policy services_owner on public.services for all
  using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

-- Availability: public read (needed to render calendars); owner CRUD.
create policy availability_select on public.availability_rules for select
  using (exists (select 1 from public.profiles p where p.id = creator_id and p.is_public)
  or auth.uid() = creator_id);
create policy availability_owner on public.availability_rules for all
  using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

create policy blocked_dates_select on public.blocked_dates for select
  using (exists (select 1 from public.profiles p where p.id = creator_id and p.is_public)
  or auth.uid() = creator_id);
create policy blocked_dates_owner on public.blocked_dates for all
  using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

-- Booking requests: ONLY creators see their own rows. Visitors never read this
-- table — they submit via the RPC below. No anon select/insert/update/delete.
create policy booking_requests_creator on public.booking_requests for all
  using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

-- Analytics: anyone may record an event for a public profile; only the owner reads.
create policy analytics_insert on public.analytics_events for insert
  with check (exists (
    select 1 from public.profiles p where p.id = creator_id and p.is_public));
create policy analytics_owner_select on public.analytics_events for select
  using (auth.uid() = creator_id);

-- ===========================================================================
-- Public DTO views (safe columns only — the Phase 1 pattern)
-- ===========================================================================
create or replace view public.public_creator_profiles as
select p.username,
       p.bio,
       p.avatar_url,
       p.wall_url,
       p.theme,
       p.category,
       p.timezone
from public.profiles p
where p.is_public and p.username is not null;

create or replace view public.public_services as
select s.id,
       p.username as creator_username,
       s.title,
       s.description,
       s.price_cents,
       s.duration_minutes,
       s.category,
       s.sort_order
from public.services s
join public.profiles p on p.id = s.creator_id
where s.is_active and p.is_public;

grant select on public.public_creator_profiles to anon, authenticated;
grant select on public.public_services to anon, authenticated;

-- ===========================================================================
-- RPCs
-- ===========================================================================

-- Generate bookable start times for a creator on a given date.
-- Respects weekly rules, blocked dates, buffer time, and existing
-- pending/accepted bookings. Times are creator-local on that date.
create or replace function public.generate_time_slots(
  p_creator_id uuid,
  p_date date,
  p_duration_minutes int
) returns table (start_time time)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz     text;
  v_buffer int;
  v_dow    smallint;
begin
  select coalesce(nullif(p.timezone, ''), 'UTC'),
         p.booking_buffer_minutes
    into v_tz, v_buffer
  from public.profiles p
  where p.id = p_creator_id and p.is_public;

  if not found then return; end if;

  if exists (select 1 from public.blocked_dates
             where creator_id = p_creator_id and date = p_date) then
    return;
  end if;

  v_dow := extract(dow from p_date)::smallint; -- 0 = Sunday

  return query
  with rules as (
    select r.start_time, r.end_time
    from public.availability_rules r
    where r.creator_id = p_creator_id and r.day_of_week = v_dow
  ),
  busy as (
    select tstzrange(
             b.requested_start - make_interval(mins => v_buffer),
             b.requested_end   + make_interval(mins => v_buffer)
           ) as during
    from public.booking_requests b
    where b.creator_id = p_creator_id
      and b.status in ('pending', 'accepted')
  ),
  slots as (
    select (r.start_time + (gs.n || ' minutes')::interval)::time as slot_start,
           r.end_time
    from rules r,
         lateral generate_series(
           0,
           greatest(0, (extract(epoch from r.end_time - r.start_time) / 60
                        - p_duration_minutes)::int),
           p_duration_minutes + v_buffer
         ) gs(n)
  )
  select s.slot_start
  from slots s
  where s.slot_start + make_interval(mins => p_duration_minutes) <= s.end_time
    and not exists (
      select 1 from busy b
      where b.during && tstzrange(
        (p_date + s.slot_start) at time zone v_tz,
        (p_date + s.slot_start) at time zone v_tz + make_interval(mins => p_duration_minutes)
      )
    )
  order by s.slot_start;
end;
$$;

-- Submit a booking request. Validates everything server-side; the exclusion
-- constraint is the final race-condition guard (concurrent takers get a
-- clean error). Rate limiting per IP/email belongs at the edge/app layer.
create or replace function public.submit_booking_request(
  p_service_id       uuid,
  p_date             date,
  p_start_time       time,
  p_client_name      text,
  p_client_email     text,
  p_client_phone     text default null,
  p_note             text default null
) returns public.booking_requests
language plpgsql security definer set search_path = public as $$
declare
  v_service public.services;
  v_profile public.profiles;
  v_tz      text;
  v_start   timestamptz;
  v_end     timestamptz;
  v_row     public.booking_requests;
begin
  if p_client_name is null or btrim(p_client_name) = '' then
    raise exception 'client_name is required';
  end if;
  if p_client_email is null or position('@' in p_client_email) = 0 then
    raise exception 'a valid client_email is required';
  end if;

  select * into v_service from public.services
  where id = p_service_id and is_active;
  if not found then raise exception 'service unavailable'; end if;

  select * into v_profile from public.profiles
  where id = v_service.creator_id;
  if not found or not v_profile.is_public then
    raise exception 'creator profile unavailable';
  end if;

  v_tz := coalesce(nullif(v_profile.timezone, ''), 'UTC');

  if p_date < (now() at time zone v_tz)::date then
    raise exception 'cannot book past dates';
  end if;

  -- Slot must currently be offered by generate_time_slots (covers blocked
  -- dates, weekly hours, buffer, and existing bookings).
  perform 1 from public.generate_time_slots(
      v_service.creator_id, p_date, v_service.duration_minutes)
    where start_time = p_start_time;
  if not found then raise exception 'time slot unavailable'; end if;

  v_start := (p_date + p_start_time) at time zone v_tz;
  v_end   := v_start + make_interval(mins => v_service.duration_minutes);

  insert into public.booking_requests (
    service_id, creator_id, client_name, client_email, client_phone,
    requested_date, requested_start, requested_end, duration_minutes, note
  ) values (
    v_service.id, v_service.creator_id, btrim(p_client_name),
    lower(btrim(p_client_email)), nullif(btrim(coalesce(p_client_phone, '')), ''),
    p_date, v_start, v_end, v_service.duration_minutes, nullif(p_note, '')
  ) returning * into v_row;

  return v_row;
exception
  when exclusion_violation then
    raise exception 'time slot was just taken — please pick another';
end;
$$;

grant execute on function public.generate_time_slots(uuid, date, int) to anon, authenticated;
grant execute on function public.submit_booking_request(uuid, date, time, text, text, text, text) to anon, authenticated;

-- ===========================================================================
-- PAYMENTS INTEGRATION POINT (Phase 3):
--   * services.price_cents already supports paid services (null = free)
--   * booking_requests is the webhook anchor: add payment_status text default
--     'unpaid' check (payment_status in ('unpaid','paid','refunded')) and a
--     stripe_payment_intent_id text column when Stripe lands.
-- ===========================================================================
