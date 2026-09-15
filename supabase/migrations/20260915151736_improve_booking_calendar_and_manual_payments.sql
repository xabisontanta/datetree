-- One accepted appointment owns the creator's local calendar day. Public callers
-- still receive only available dates/times and cannot infer why a date is closed.
create or replace function dt_private.slots(service uuid, from_date date, requested_duration integer default null) returns table(start_at timestamptz,end_at timestamptz) language plpgsql security definer set search_path='' as $$
declare c uuid; s jsonb; a jsonb; tz text; day date; win jsonb; rules jsonb; ex jsonb; lo timestamp; hi timestamp; first_at timestamptz; last_at timestamptz; duration interval; pad interval;
begin
  select creator_id,definition into c,s from public.dt_services where id=service and active;
  if c is null or s->>'kind'<>'scheduled' or not exists(select 1 from public.profiles_public where creator_id=c and is_published) or exists(select 1 from public.profiles_private where id=c and requests_paused_at is not null) then return; end if;
  select availability into a from dt_private.published_settings where creator_id=c;
  tz:=a->>'timezone'; duration:=make_interval(mins=>coalesce(requested_duration,(s->>'duration')::int)); pad:=make_interval(mins=>(a->>'buffer')::int);
  if from_date < (now() at time zone 'UTC')::date-1 or from_date>(now() at time zone 'UTC')::date+(a->>'horizon')::int then return; end if;
  for day in select generate_series(from_date-1,from_date+2,interval '1 day')::date loop
    select value into ex from jsonb_array_elements(a->'exceptions') where value->>'date'=day::text limit 1;
    if ex is not null then rules:=ex->'windows'; else select coalesce(jsonb_agg(value),'[]') into rules from jsonb_array_elements(a->'windows') where (value->>'day')::int=extract(dow from day)::int; end if;
    for win in select value from jsonb_array_elements(rules) loop
      lo:=day+(win->>'start')::time; hi:=day+(win->>'end')::time;
      if hi<=lo then hi:=hi+interval '1 day'; end if;
      first_at:=lo at time zone tz; last_at:=hi at time zone tz;
      if first_at at time zone tz<>lo or last_at at time zone tz<>hi then continue; end if;
      return query select t,t+duration from generate_series(first_at,last_at-duration,interval '15 minutes') t
        where t>=from_date::timestamp at time zone 'UTC' and t<(from_date+1)::timestamp at time zone 'UTC'
        and t>=now()+make_interval(hours=>(a->>'notice')::int) and t+duration<=now()+make_interval(days=>(a->>'horizon')::int)
        and not exists(select 1 from jsonb_array_elements(a->'exceptions') other where (other->>'date')::date<>day and (other->>'date')::date between (t at time zone tz)::date and ((t+duration-interval '1 microsecond') at time zone tz)::date)
        and not exists(select 1 from public.dt_requests r where r.creator_id=c and r.status in ('CONFIRMED','ACCEPTED_AWAITING_PAYMENT') and r.snapshot->>'kind'='scheduled' and r.start_at is not null and (r.start_at at time zone tz)::date=(t at time zone tz)::date);
    end loop;
  end loop;
end $$;

create function dt_private.available_dates(service uuid, month_start date) returns table(available_date date) language plpgsql security definer set search_path='' as $$
declare tz text;
begin
  if month_start is null or month_start<>date_trunc('month',month_start)::date or month_start<date_trunc('month',current_date)::date or month_start>date_trunc('month',current_date+interval '90 days')::date then return; end if;
  select ps.availability->>'timezone' into tz from public.dt_services s join dt_private.published_settings ps on ps.creator_id=s.creator_id where s.id=service and s.active;
  if tz is null then return; end if;
  return query
    select distinct (slot.start_at at time zone tz)::date
    from generate_series(month_start-1,(month_start+interval '1 month')::date,interval '1 day') utc_day
    cross join lateral dt_private.slots(service,utc_day::date) slot
    where (slot.start_at at time zone tz)::date>=month_start
      and (slot.start_at at time zone tz)::date<(month_start+interval '1 month')::date
    order by 1;
end $$;

create function public.dt_available_dates(service uuid, month_start date) returns table(available_date date) language sql security invoker set search_path='' as $$ select * from dt_private.available_dates(service,month_start) $$;
revoke all on function dt_private.available_dates(uuid,date),public.dt_available_dates(uuid,date) from public,anon,authenticated;
grant execute on function dt_private.available_dates(uuid,date),public.dt_available_dates(uuid,date) to anon,authenticated;

-- Until a payment provider is connected, fixed prices are informational and the
-- creator arranges payment directly. Date Tree never records these as paid.
create or replace function dt_private.transition_request(rid uuid, operation text, expected_version integer, proposed_start timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=dt_private.actor(); r public.dt_requests; c uuid; target text; new_end timestamptz; pad interval; a jsonb;
begin
  select creator_id into c from public.dt_requests where id=rid and (creator_id=uid or requester_id=uid);
  if c is null then raise exception 'Request not found.'; end if;
  perform 1 from public.profiles_private where id=c for update;
  select * into r from public.dt_requests where id=rid for update;
  if expected_version is null or expected_version<1 then raise exception 'Invalid request version.'; end if;
  if r.version=expected_version+1 and ((operation in ('accept','accept_counter') and r.status='CONFIRMED') or (operation='decline' and r.status='DECLINED') or (operation='cancel' and r.status='CANCELLED') or (operation='complete' and r.status='COMPLETED') or (operation='counter' and r.status='COUNTER_PROPOSED' and r.start_at=proposed_start)) then return; end if;
  if r.version<>expected_version then raise exception 'This request changed. Reload for its latest status.'; end if;
  if operation='decline' and uid=c and r.status in ('PENDING_CREATOR','COUNTER_PROPOSED') then target:='DECLINED';
  elsif operation='cancel' and r.status in ('PENDING_CREATOR','COUNTER_PROPOSED','CONFIRMED') then target:='CANCELLED';
  elsif operation='complete' and uid=c and r.status='CONFIRMED' and (r.end_at is null or r.end_at<=now()) then target:='COMPLETED';
  elsif operation='counter' and uid=c and r.status in ('PENDING_CREATOR','COUNTER_PROPOSED') and r.snapshot->>'kind'='scheduled' then
    select x.end_at into new_end from dt_private.slots(r.service_id,(proposed_start at time zone 'UTC')::date,(r.snapshot->>'duration')::int) x where x.start_at=proposed_start limit 1;
    if new_end is null then raise exception 'Choose an available time.'; end if;
    r.start_at:=proposed_start; r.end_at:=proposed_start+make_interval(mins=>(r.snapshot->>'duration')::int); target:='COUNTER_PROPOSED';
  elsif (operation='accept' and uid=c and r.status='PENDING_CREATOR') or (operation='accept_counter' and uid=r.requester_id and r.status='COUNTER_PROPOSED') then
    if not exists(select 1 from public.profiles_public where creator_id=c and is_published) or exists(select 1 from public.profiles_private where id=c and requests_paused_at is not null) or not exists(select 1 from public.dt_services where id=r.service_id and active) then raise exception 'This service is not accepting requests.'; end if;
    if r.snapshot->>'pricing'='quote' and r.snapshot->>'kind'<>'enquiry' then raise exception 'A quoted service needs an agreed price before acceptance. Use an enquiry service for quotations.'; end if;
    if r.snapshot->>'kind'='scheduled' then
      select x.end_at into new_end from dt_private.slots(r.service_id,(r.start_at at time zone 'UTC')::date,(r.snapshot->>'duration')::int) x where x.start_at=r.start_at limit 1;
      if new_end is null or new_end<>r.end_at then raise exception 'This appointment is no longer available. Propose another time.'; end if;
      select availability into a from dt_private.published_settings where creator_id=c;
      pad:=make_interval(mins=>(a->>'buffer')::int);
      r.reserved_from:=r.start_at-pad; r.reserved_until:=r.end_at+pad; target:='CONFIRMED';
    elsif r.snapshot->>'kind'='deliverable' then
      if (select count(*) from public.dt_requests where creator_id=c and service_id=r.service_id and status='CONFIRMED') >= (select (definition->>'capacity')::int from public.dt_services where id=r.service_id) then raise exception 'Delivery capacity reached. Complete an existing request first.'; end if;
      target:='CONFIRMED';
    else target:='CONFIRMED'; end if;
  else raise exception 'That action is not allowed for this request.'; end if;
  update public.dt_requests set status=target,accepted_at=case when target='CONFIRMED' then coalesce(accepted_at,now()) else accepted_at end,delivery_due_at=case when target='CONFIRMED' and r.snapshot->>'kind'='deliverable' then coalesce(delivery_due_at,now()+make_interval(days=>(r.snapshot->>'turnaround')::int)) else delivery_due_at end,start_at=r.start_at,end_at=r.end_at,reserved_from=case when target='CONFIRMED' then r.reserved_from else null end,reserved_until=case when target='CONFIRMED' then r.reserved_until else null end,version=version+1,updated_at=now() where id=rid;
end $$;

create or replace function dt_private.request_integrity() returns trigger language plpgsql security definer set search_path='' as $$
declare tz text;
begin
  perform 1 from public.profiles_private where id=new.creator_id for update;
  if new.status in ('CONFIRMED','ACCEPTED_AWAITING_PAYMENT') and new.snapshot->>'kind'='scheduled' then
    if new.reserved_from is null or new.reserved_until is null or new.start_at is null then raise exception 'Reservation required.'; end if;
    select availability->>'timezone' into tz from dt_private.published_settings where creator_id=new.creator_id;
    if exists(select 1 from public.dt_requests r where r.creator_id=new.creator_id and r.id<>new.id and r.status in ('CONFIRMED','ACCEPTED_AWAITING_PAYMENT') and r.snapshot->>'kind'='scheduled' and r.start_at is not null and ((tz is not null and (r.start_at at time zone tz)::date=(new.start_at at time zone tz)::date) or (tz is null and tstzrange(r.reserved_from,r.reserved_until,'[)') && tstzrange(new.reserved_from,new.reserved_until,'[)')))) then raise exception 'Appointment conflict.'; end if;
  end if;
  return new;
end $$;
