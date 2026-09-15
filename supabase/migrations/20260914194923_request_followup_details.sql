alter table public.dt_requests add column accepted_at timestamptz;
alter table public.dt_requests add column delivery_due_at timestamptz;
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
    if r.snapshot->>'pricing'='fixed' then raise exception 'Payment processing is not configured. Paid requests cannot be accepted yet.'; end if;
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


-- The creator can contact the client who explicitly consented to this request.
-- Creator email/phone is never returned, and requesters cannot list other contacts.
create function dt_private.request_contacts() returns table(request_id uuid,email text) language plpgsql security definer set search_path='' as $$
declare uid uuid:=dt_private.actor();
begin
  return query select r.id,r.requester_email from public.dt_requests r where r.creator_id=uid;
end $$;
create function public.dt_request_contacts() returns table(request_id uuid,email text) language sql security invoker set search_path='' as $$ select * from dt_private.request_contacts() $$;
revoke all on function dt_private.request_contacts(),public.dt_request_contacts() from public,anon,authenticated;
grant execute on function dt_private.request_contacts(),public.dt_request_contacts() to authenticated;
