-- Keep the established one-appointment-per-local-day policy, and also hide
-- buffer conflicts crossing into a different day. Existing GiST exclusion
-- constraints remain the final atomic acceptance boundary.
create or replace function dt_private.slots(
  service uuid, from_date date, requested_duration integer default null
) returns table(start_at timestamptz, end_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare
  c uuid; s jsonb; a jsonb; tz text; day date; win jsonb; rules jsonb;
  ex jsonb; lo timestamp; hi timestamp; first_at timestamptz;
  last_at timestamptz; duration interval; pad interval;
begin
  select creator_id, definition into c, s
  from public.dt_services where id=service and active;
  if c is null or s->>'kind'<>'scheduled'
    or not exists(select 1 from public.profiles_public where creator_id=c and is_published)
    or exists(select 1 from public.profiles_private where id=c and requests_paused_at is not null)
  then return; end if;
  select availability into a from dt_private.published_settings where creator_id=c;
  tz:=a->>'timezone';
  duration:=make_interval(mins=>coalesce(requested_duration,(s->>'duration')::int));
  pad:=make_interval(mins=>(a->>'buffer')::int);
  if from_date < (now() at time zone 'UTC')::date-1
    or from_date>(now() at time zone 'UTC')::date+(a->>'horizon')::int
  then return; end if;
  for day in select generate_series(from_date-1,from_date+2,interval '1 day')::date loop
    select value into ex from jsonb_array_elements(a->'exceptions')
    where value->>'date'=day::text limit 1;
    if ex is not null then rules:=ex->'windows';
    else
      select coalesce(jsonb_agg(value),'[]') into rules
      from jsonb_array_elements(a->'windows')
      where (value->>'day')::int=extract(dow from day)::int;
    end if;
    for win in select value from jsonb_array_elements(rules) loop
      lo:=day+(win->>'start')::time; hi:=day+(win->>'end')::time;
      if hi<=lo then hi:=hi+interval '1 day'; end if;
      first_at:=lo at time zone tz; last_at:=hi at time zone tz;
      if first_at at time zone tz<>lo or last_at at time zone tz<>hi
      then continue; end if;
      return query
        select t,t+duration
        from generate_series(first_at,last_at-duration,interval '15 minutes') t
        where t>=from_date::timestamp at time zone 'UTC'
          and t<(from_date+1)::timestamp at time zone 'UTC'
          and t>=now()+make_interval(hours=>(a->>'notice')::int)
          and t+duration<=now()+make_interval(days=>(a->>'horizon')::int)
          and not exists(
            select 1 from jsonb_array_elements(a->'exceptions') other
            where (other->>'date')::date<>day
              and (other->>'date')::date between (t at time zone tz)::date
                and ((t+duration-interval '1 microsecond') at time zone tz)::date
          )
          and not exists(
            select 1 from public.dt_requests r
            where r.creator_id=c and r.status in ('CONFIRMED','ACCEPTED_AWAITING_PAYMENT')
              and r.snapshot->>'kind'='scheduled' and r.start_at is not null
              and (r.start_at at time zone tz)::date=(t at time zone tz)::date
          )
          and not exists(
            select 1 from public.dt_requests r
            where r.creator_id=c and r.status in ('CONFIRMED','ACCEPTED_AWAITING_PAYMENT')
              and r.reserved_from is not null
              and tstzrange(r.reserved_from,r.reserved_until,'[)')
                && tstzrange(t-pad,t+duration+pad,'[)')
          );
    end loop;
  end loop;
end $$;

-- Until a verified payment adapter exists, fail closed instead of silently
-- confirming new fixed-price appointments, deliverables or enquiries.
-- Existing legacy confirmations are preserved and may still be closed/cancelled.
create function dt_private.guard_unconfigured_payment() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.status='CONFIRMED' and new.snapshot->>'pricing'='fixed' then
    if tg_op='INSERT' then
      raise exception 'Online payments are not connected. Fixed-price requests cannot be accepted yet.';
    elsif old.status is distinct from 'CONFIRMED' then
      raise exception 'Online payments are not connected. Fixed-price requests cannot be accepted yet.';
    end if;
  end if;
  return new;
end $$;
revoke all on function dt_private.guard_unconfigured_payment()
  from public, anon, authenticated;
create trigger dt_guard_unconfigured_payment before insert or update
  on public.dt_requests for each row
  execute function dt_private.guard_unconfigured_payment();
