-- Keep the original API available to previously deployed clients. New clients
-- explicitly use the visitor's IANA zone for both calendar dates and slot labels.
create function dt_private.available_dates_in_zone(service uuid, month_start date, visitor_timezone text)
returns table(available_date date) language plpgsql security definer set search_path='' as $$
begin
  if visitor_timezone is null or not exists(select 1 from pg_timezone_names where name=visitor_timezone) then
    raise exception 'Choose a valid timezone.';
  end if;
  if month_start is null or month_start<>date_trunc('month',month_start)::date
    or month_start<date_trunc('month',now() at time zone visitor_timezone)::date
    or month_start>date_trunc('month',(now()+interval '90 days') at time zone visitor_timezone)::date then return; end if;
  return query
    select distinct (slot.start_at at time zone visitor_timezone)::date
    from generate_series(month_start-1,(month_start+interval '1 month')::date,interval '1 day') utc_day
    cross join lateral dt_private.slots(service,utc_day::date) slot
    where (slot.start_at at time zone visitor_timezone)::date>=month_start
      and (slot.start_at at time zone visitor_timezone)::date<(month_start+interval '1 month')::date
    order by 1;
end $$;
create function public.dt_available_dates_in_zone(service uuid, month_start date, visitor_timezone text)
returns table(available_date date) language sql security invoker set search_path='' as $$
  select * from dt_private.available_dates_in_zone(service,month_start,visitor_timezone)
$$;
revoke all on function dt_private.available_dates_in_zone(uuid,date,text),public.dt_available_dates_in_zone(uuid,date,text) from public,anon,authenticated;
grant execute on function dt_private.available_dates_in_zone(uuid,date,text),public.dt_available_dates_in_zone(uuid,date,text) to anon,authenticated;
