-- Compatible, Date Tree-only rollout. Channels are OFF until live delivery proof.
-- Legacy snapshots remain private and immutable; no request is marked paid.
-- Restore an explicit allowlist rather than exposing arbitrary new draft fields.
create or replace function dt_private.public_document(d jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('profile', (select jsonb_object_agg(key,value)
    from jsonb_each(d->'profile') where key=any(array['themeVersion','username',
    'displayName','bio','tagline','avatar','cover','backgroundImage','avatarPosition',
    'coverPosition','backgroundPosition','theme','accent','background','backgroundType',
    'gradient','font','buttons','cards','scheme','links'])), 'services', coalesce((
    select jsonb_agg((select jsonb_object_agg(key,value) from jsonb_each(s)
      where key=any(array['id','title','description','kind','active','image','duration',
        'mode','location','turnaround','capacity','instructions','questions'])))
    from jsonb_array_elements(d->'services') s where s->>'active'='true'
  ), '[]'::jsonb));
$$;
update public.profiles_public set document=dt_private.public_document(document)
where document is not null;
update public.dt_services set definition=definition-array['pricing','amount','currency'];

alter table public.dt_requests
  add column arrangement_policy text not null default 'external-v1'
    check (arrangement_policy='external-v1'),
  add column preferred_contact text check (preferred_contact in ('email','whatsapp')),
  add column preferred_contact_address text,
  add column contact_shared_at timestamptz,
  add column whatsapp_notification_consent_at timestamptz;
-- Old general sharing consent is not retrospective consent to publish a contact.
-- Existing requests and their original terms remain intact; do not backfill contacts.
revoke select on public.dt_requests from authenticated;
grant select (id,creator_id,service_id,requester_id,idempotency_key,snapshot,
  requester_name,notes,answers,preferred_date,start_at,end_at,reserved_from,
  reserved_until,visitor_timezone,status,adult_confirmed_at,sharing_consent_at,
  version,created_at,updated_at,accepted_at,delivery_due_at,arrangement_policy)
on public.dt_requests to authenticated;
create or replace function dt_private.guard_unconfigured_payment() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.status='CONFIRMED' and new.arrangement_policy <> 'external-v1' then
    raise exception 'Review the arrangement policy before accepting.';
  end if;
  return new;
end $$;

create table dt_private.contact_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  whatsapp_number text check (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_verified_at timestamptz,
  whatsapp_consent_at timestamptz,
  updated_at timestamptz not null default now(),
  check (whatsapp_verified_at is not null or whatsapp_consent_at is null),
  check (whatsapp_number is not null or whatsapp_verified_at is null)
);
alter table dt_private.contact_preferences enable row level security;
revoke all on dt_private.contact_preferences from public,anon,authenticated;

create function dt_private.contact_settings() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=dt_private.actor(); result jsonb;
begin
  select jsonb_build_object('email',u.email,'whatsappNumber',p.whatsapp_number,
    'whatsappVerified',p.whatsapp_verified_at is not null,
    'whatsappConsent',p.whatsapp_consent_at is not null) into result
  from auth.users u left join dt_private.contact_preferences p on p.user_id=u.id
  where u.id=uid;
  return result;
end $$;
create function dt_private.set_contact_preferences(number text, opt_in boolean)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=dt_private.actor(); p dt_private.contact_preferences;
begin
  if opt_in is null or (number is not null and number !~ '^\+[1-9][0-9]{7,14}$')
    then raise exception 'Use international format, for example +27656193535.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,31));
  select * into p from dt_private.contact_preferences where user_id=uid for update;
  if opt_in and (p.whatsapp_verified_at is null or p.whatsapp_number is distinct from number)
    then raise exception 'Verify this WhatsApp number before opting in.'; end if;
  insert into dt_private.contact_preferences(user_id,whatsapp_number)
    values(uid,number) on conflict(user_id) do nothing;
  update dt_private.contact_preferences set whatsapp_number=number,
    whatsapp_verified_at=case when p.whatsapp_number=number then p.whatsapp_verified_at end,
    whatsapp_consent_at=case when opt_in and p.whatsapp_number=number
      then coalesce(p.whatsapp_consent_at,statement_timestamp()) end,
    updated_at=statement_timestamp() where user_id=uid;
end $$;
create function public.dt_contact_settings() returns jsonb language sql
security invoker set search_path='' as $$ select dt_private.contact_settings() $$;
create function public.dt_set_contact_preferences(number text, opt_in boolean)
returns void language sql security invoker set search_path='' as $$
  select dt_private.set_contact_preferences(number,opt_in)
$$;
revoke all on function dt_private.contact_settings(),dt_private.set_contact_preferences(text,boolean),
  public.dt_contact_settings(),public.dt_set_contact_preferences(text,boolean)
from public,anon,authenticated;
grant execute on function dt_private.contact_settings(),dt_private.set_contact_preferences(text,boolean),
  public.dt_contact_settings(),public.dt_set_contact_preferences(text,boolean) to authenticated;

create or replace function dt_private.submit_request(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=dt_private.actor(); sid uuid:=(payload->>'serviceId')::uuid;
  c uuid; s jsonb; rid uuid; begin_at timestamptz:=nullif(payload->>'start','')::timestamptz;
  finish_at timestamptz; email text; selected_contact text; q jsonb; i integer:=0;
  p dt_private.contact_preferences;
begin
  if payload is null or octet_length(payload::text)>20000 or jsonb_typeof(payload)<>'object'
    then raise exception 'Invalid request.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,19));
  select id into rid from public.dt_requests where requester_id=uid
    and idempotency_key=(payload->>'idempotencyKey')::uuid;
  if rid is not null then return rid; end if;
  if (select count(*) from public.dt_requests where requester_id=uid
    and created_at>now()-interval '1 hour')>=10 then
    raise exception 'Request limit reached. Please try again later.'; end if;
  select creator_id,definition into c,s from public.dt_services where id=sid and active;
  perform 1 from public.profiles_private where id=c for update;
  if c is null or c=uid or not exists(select 1 from public.profiles_public
    where creator_id=c and is_published) or exists(select 1 from public.profiles_private
    where id=c and requests_paused_at is not null) then
    raise exception 'This service is not accepting requests.'; end if;
  select definition into s from public.dt_services where id=sid and active;
  if s is null or s is distinct from payload->'serviceSnapshot' then
    raise exception 'This service changed. Reload and review it before submitting.'; end if;
  if payload->'adult' is distinct from 'true'::jsonb
    or payload->'consent' is distinct from 'true'::jsonb
    or payload->'contactSharingConsent' is distinct from 'true'::jsonb
    or coalesce(payload->>'preferredContact','') not in ('email','whatsapp')
    or jsonb_typeof(payload->'whatsappNotificationConsent') is distinct from 'boolean'
    or coalesce(length(payload->>'name'),0) not between 1 and 80
    or length(payload->>'notes')>2000 or not exists(select 1 from pg_timezone_names
    where name=payload->>'timezone') then raise exception 'Check your details and consent.'; end if;
  if jsonb_typeof(payload->'answers') is distinct from 'array'
    or jsonb_array_length(payload->'answers')<>jsonb_array_length(s->'questions')
    or exists(select 1 from jsonb_array_elements(payload->'answers') answer
    where jsonb_typeof(answer)<>'string') then raise exception 'Check your answers.'; end if;
  for q in select value from jsonb_array_elements(s->'questions') loop
    if length(payload->'answers'->>i)>1000 or (q->>'required'='true'
      and coalesce(length(trim(payload->'answers'->>i)),0)=0)
      then raise exception 'Please answer the required questions.'; end if;
    i:=i+1;
  end loop;
  if s->>'kind'='scheduled' then
    select x.end_at into finish_at from dt_private.slots(sid,(begin_at at time zone 'UTC')::date) x
    where x.start_at=begin_at limit 1;
    if finish_at is null then raise exception 'That time is no longer available. Choose another.'; end if;
  else begin_at:=null;
    if nullif(payload->>'preferredDate','')::date<current_date
      then raise exception 'Choose a future delivery preference.'; end if;
  end if;
  select u.email into email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,31));
  select * into p from dt_private.contact_preferences where user_id=uid for update;
  if payload->>'preferredContact'='whatsapp' or payload->'whatsappNotificationConsent'='true'::jsonb then
    if p.whatsapp_verified_at is null then raise exception 'Verify your WhatsApp number first.'; end if;
  end if;
  selected_contact:=case when payload->>'preferredContact'='email' then email else p.whatsapp_number end;
  if payload->'whatsappNotificationConsent'='true'::jsonb then
    update dt_private.contact_preferences set whatsapp_consent_at=coalesce(whatsapp_consent_at,now())
    where user_id=uid;
  end if;
  insert into public.dt_requests(creator_id,service_id,requester_id,idempotency_key,snapshot,
    requester_name,requester_email,notes,answers,preferred_date,start_at,end_at,visitor_timezone,
    preferred_contact,preferred_contact_address,contact_shared_at,whatsapp_notification_consent_at)
  values(c,sid,uid,(payload->>'idempotencyKey')::uuid,s,payload->>'name',email,
    coalesce(payload->>'notes',''),payload->'answers',nullif(payload->>'preferredDate','')::date,
    begin_at,finish_at,payload->>'timezone',payload->>'preferredContact',selected_contact,now(),
    case when payload->'whatsappNotificationConsent'='true'::jsonb then now() end) returning id into rid;
  insert into dt_private.request_meeting_details(request_id,details)
    select rid,details from dt_private.service_details where service_id=sid;
  return rid;
end $$;

drop function public.dt_request_contacts();
drop function dt_private.request_contacts();
create function dt_private.request_contacts() returns table(request_id uuid,kind text,address text)
language plpgsql security definer set search_path='' as $$
declare uid uuid:=dt_private.actor();
begin
  return query select r.id,r.preferred_contact,r.preferred_contact_address
  from public.dt_requests r join auth.users u on u.id=r.requester_id
  left join dt_private.contact_preferences p on p.user_id=r.requester_id
  where r.creator_id=uid and r.contact_shared_at is not null
    and ((r.preferred_contact='email' and u.email_confirmed_at is not null
      and u.email=r.preferred_contact_address) or (r.preferred_contact='whatsapp'
      and p.whatsapp_verified_at is not null and p.whatsapp_number=r.preferred_contact_address));
end $$;
create function public.dt_request_contacts() returns table(request_id uuid,kind text,address text)
language sql security invoker set search_path='' as $$ select * from dt_private.request_contacts() $$;
revoke all on function dt_private.request_contacts(),public.dt_request_contacts() from public,anon,authenticated;
grant execute on function dt_private.request_contacts(),public.dt_request_contacts() to authenticated;

create function dt_private.revoke_request_contact(rid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=dt_private.actor(); creator uuid;
begin
  select creator_id into creator from public.dt_requests where id=rid and requester_id=uid;
  if creator is null then raise exception 'Request not found.'; end if;
  -- Match submit/transition lock order: creator before request row.
  perform 1 from public.profiles_private where id=creator for update;
  update public.dt_requests set contact_shared_at=null where id=rid and requester_id=uid;
  if not found then raise exception 'Request not found.'; end if;
end $$;
create function public.dt_revoke_request_contact(rid uuid) returns void language sql
security invoker set search_path='' as $$ select dt_private.revoke_request_contact(rid) $$;
revoke all on function dt_private.revoke_request_contact(uuid),public.dt_revoke_request_contact(uuid)
from public,anon,authenticated;
grant execute on function dt_private.revoke_request_contact(uuid),public.dt_revoke_request_contact(uuid) to authenticated;

create table dt_private.activity_reads (
  user_id uuid references auth.users(id) on delete cascade,
  request_id uuid references public.dt_requests(id) on delete cascade,
  through_event bigint not null, primary key(user_id,request_id)
);
alter table dt_private.activity_reads enable row level security;
revoke all on dt_private.activity_reads from public,anon,authenticated;
create function dt_private.notification_feed(rid uuid default null)
returns table(request_id uuid,event_id bigint,status text,created_at timestamptz,unread boolean)
language plpgsql security definer set search_path='' as $$
declare uid uuid:=dt_private.actor();
begin
  return query select e.request_id,e.id,e.status,e.created_at,e.id>coalesce(a.through_event,0)
  from public.dt_request_events e join public.dt_requests r on r.id=e.request_id
  left join dt_private.activity_reads a on a.user_id=uid and a.request_id=r.id
  where uid in(r.creator_id,r.requester_id) and (rid is null or r.id=rid)
  order by e.id desc limit 1000;
end $$;
create function dt_private.mark_activity_read(rid uuid,through_event bigint) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=dt_private.actor();
begin
  if not exists(select 1 from public.dt_requests where id=rid and uid in(creator_id,requester_id))
    or not exists(select 1 from public.dt_request_events where id=through_event and request_id=rid)
    then raise exception 'Request not found.'; end if;
  insert into dt_private.activity_reads values(uid,rid,through_event)
  on conflict(user_id,request_id) do update set through_event=greatest(
    dt_private.activity_reads.through_event,excluded.through_event);
end $$;
create function public.dt_notification_feed(rid uuid default null)
returns table(request_id uuid,event_id bigint,status text,created_at timestamptz,unread boolean)
language sql security invoker set search_path='' as $$ select * from dt_private.notification_feed(rid) $$;
create function public.dt_mark_activity_read(rid uuid,through_event bigint) returns void
language sql security invoker set search_path='' as $$ select dt_private.mark_activity_read(rid,through_event) $$;
revoke all on function dt_private.notification_feed(uuid),dt_private.mark_activity_read(uuid,bigint),
  public.dt_notification_feed(uuid),public.dt_mark_activity_read(uuid,bigint) from public,anon,authenticated;
grant execute on function dt_private.notification_feed(uuid),dt_private.mark_activity_read(uuid,bigint),
  public.dt_notification_feed(uuid),public.dt_mark_activity_read(uuid,bigint) to authenticated;

create table dt_private.notification_channels (
  channel text primary key check(channel in('email','whatsapp')),
  enabled boolean not null default false,
  activated_at timestamptz,
  recipient_allowlist uuid[],
  check(not enabled or activated_at is not null)
);
insert into dt_private.notification_channels(channel) values('email'),('whatsapp');
alter table dt_private.notification_channels enable row level security;
revoke all on dt_private.notification_channels from public,anon,authenticated;
alter table dt_private.notification_deliveries drop constraint notification_deliveries_status_check;
alter table dt_private.notification_deliveries add constraint notification_deliveries_status_check
check(status in('provider_not_configured','queued','processing','accepted','delivered',
  'retry_scheduled','permanent_failure','uncertain','suppressed','bounced'));
alter table dt_private.notification_deliveries
  add column recipient_id uuid references auth.users(id),
  add column callback_token uuid not null default gen_random_uuid(),
  add column send_started_at timestamptz,
  add column attempt_started_at timestamptz,
  add column definitely_unsent boolean not null default true,
  add column provider_payload jsonb,
  add column provider_event_at timestamptz;
update dt_private.notification_deliveries d set recipient_id=case
  when d.recipient_role='creator' then r.creator_id else r.requester_id end
from public.dt_requests r where r.id=d.request_id;
alter table dt_private.notification_deliveries alter column recipient_id set not null;
create index dt_delivery_provider_idx on dt_private.notification_deliveries(channel,provider_reference)
where provider_reference is not null;
create table dt_private.delivery_callbacks (
  channel text not null, event_key text not null,
  provider_reference text not null, status text not null,
  occurred_at timestamptz not null, received_at timestamptz not null default now(),
  primary key(channel,event_key)
);
alter table dt_private.delivery_callbacks enable row level security;
revoke all on dt_private.delivery_callbacks from public,anon,authenticated;

create or replace function dt_private.queue_notification(outbox bigint) returns void
language plpgsql security definer set search_path='' as $$
declare r public.dt_requests; e public.dt_request_events; creator_name text; first_event boolean;
  recipient record; template text; contact jsonb; p dt_private.contact_preferences;
begin
  select x.* into e from public.dt_request_events x join public.dt_notification_outbox o
    on o.event_id=x.id where o.id=outbox;
  if e.id is null then return; end if;
  select * into r from public.dt_requests where id=e.request_id;
  select display_name into creator_name from public.profiles_public where creator_id=r.creator_id;
  first_event:=not exists(select 1 from public.dt_request_events where request_id=r.id and id<e.id);
  select * into p from dt_private.contact_preferences where user_id=r.requester_id;
  if r.contact_shared_at is not null and ((r.preferred_contact='email' and exists(
    select 1 from auth.users where id=r.requester_id and email=r.preferred_contact_address
    and email_confirmed_at is not null)) or (r.preferred_contact='whatsapp'
    and p.whatsapp_verified_at is not null and p.whatsapp_number=r.preferred_contact_address)) then
    contact:=jsonb_build_object('kind',r.preferred_contact,'address',r.preferred_contact_address);
  end if;
  for recipient in
    select u.id as user_id,case when u.id=r.creator_id then 'creator' else 'requester' end as role,
      'email'::text as channel,u.email as address
    from auth.users u where u.id in(r.creator_id,r.requester_id) and u.email_confirmed_at is not null
    union all
    select u.user_id,case when u.user_id=r.creator_id then 'creator' else 'requester' end,
      'whatsapp',u.whatsapp_number from dt_private.contact_preferences u
    where u.user_id in(r.creator_id,r.requester_id) and u.whatsapp_verified_at is not null
      and u.whatsapp_consent_at is not null and (u.user_id=r.creator_id
        or r.whatsapp_notification_consent_at is not null)
  loop
    if not first_event and e.actor_id=recipient.user_id then continue; end if;
    template:=case when first_event and recipient.role='requester' then 'REQUEST_RECEIVED'
      when e.status='PENDING_CREATOR' then 'NEW_BOOKING_REQUEST'
      when e.status='COUNTER_PROPOSED' then 'COUNTER_OFFER'
      when e.status='CONFIRMED' then 'BOOKING_CONFIRMED'
      when e.status='DECLINED' then 'BOOKING_DECLINED'
      when e.status='CANCELLED' then 'BOOKING_CANCELLED'
      when e.status='COMPLETED' then 'BOOKING_COMPLETED' else 'BOOKING_STATUS_UPDATED' end;
    insert into dt_private.notification_deliveries(outbox_id,request_id,event_id,recipient_id,
      recipient_role,channel,recipient_address,template_name,payload,idempotency_key,status)
    values(outbox,r.id,e.id,recipient.user_id,recipient.role,recipient.channel,recipient.address,template,
      jsonb_build_object('creatorName',coalesce(creator_name,'Your creator'),
        'requesterName',r.requester_name,'serviceName',r.snapshot->>'title','kind',r.snapshot->>'kind',
        'requestReference',left(r.id::text,8),'status',e.status,'requestVersion',r.version,
        'startAt',r.start_at,'endAt',r.end_at,'deliveryDueAt',r.delivery_due_at,'timezone',r.visitor_timezone,
        'recipientRole',recipient.role,'preferredContact',case when recipient.role='creator' then contact end,
        'actionPath',case when recipient.role='creator' then '/dashboard/requests/' else '/requests/' end||r.id),
      'unused',case when exists(select 1 from dt_private.notification_channels c
        where c.channel=recipient.channel and e.created_at>=c.activated_at)
        then 'queued' else 'provider_not_configured' end)
    on conflict(event_id,recipient_role,channel) do nothing;
  end loop;
end $$;

create function dt_private.shared_contact_eligible(d dt_private.notification_deliveries) returns boolean
language sql stable security definer set search_path='' as $$
  select d.payload->'preferredContact' is null or d.payload->'preferredContact'='null'::jsonb
    or exists(select 1 from public.dt_requests r where r.id=d.request_id
      and r.contact_shared_at is not null
      and d.payload#>>'{preferredContact,address}'=r.preferred_contact_address
      and ((r.preferred_contact='email' and exists(select 1 from auth.users ru
        where ru.id=r.requester_id and ru.email=r.preferred_contact_address and ru.email_confirmed_at is not null))
        or (r.preferred_contact='whatsapp' and exists(select 1 from dt_private.contact_preferences rp
        where rp.user_id=r.requester_id and rp.whatsapp_number=r.preferred_contact_address
        and rp.whatsapp_verified_at is not null))));
$$;
create function dt_private.delivery_eligible(d dt_private.notification_deliveries) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u join public.dt_requests r on r.id=d.request_id
    left join dt_private.contact_preferences p on p.user_id=u.id
    where u.id=d.recipient_id and (
      (d.channel='email' and u.email_confirmed_at is not null and u.email=d.recipient_address
        and not exists(select 1 from dt_private.notification_deliveries failed
          where failed.recipient_id=u.id and failed.recipient_address=u.email and failed.status='bounced'))
      or (d.channel='whatsapp' and p.whatsapp_verified_at is not null
        and p.whatsapp_consent_at is not null and p.whatsapp_number=d.recipient_address
        and (d.recipient_role='creator' or r.whatsapp_notification_consent_at is not null)))
    and dt_private.shared_contact_eligible(d)
  );
$$;

-- Scheduler and interactive dispatch use identical fenced claim rules.
create function dt_private.claim_notification_batch(rid uuid,requested_by uuid,
  allowed_channels text[],batch_size integer)
returns table(delivery_id bigint,claim_token uuid,idempotency_key text,channel text,
  recipient_address text,template_name text,payload jsonb,attempts integer,callback_token uuid)
language plpgsql security definer set search_path='' as $$
begin
  if batch_size is null or allowed_channels is null or (rid is not null and
    (requested_by is null or not exists(select 1 from public.dt_requests where id=rid
      and requested_by in(creator_id,requester_id)))) then raise exception 'Notification request is not authorized.'; end if;
  -- Never reclaim a WhatsApp send after an ambiguous crash. Its signed callback can reconcile it.
  update dt_private.notification_deliveries d set status='uncertain',claim_token=null,claimed_at=null,
    last_error_code='lease_expired_after_send',updated_at=now()
  where (rid is null or d.request_id=rid) and d.channel='whatsapp' and d.status='processing'
    and d.attempt_started_at is not null and d.claimed_at<now()-interval '5 minutes';
  -- Before the first immutable payload is prepared, retain the notice but redact
  -- withdrawn contact. Never change an already prepared idempotent payload.
  update dt_private.notification_deliveries d set payload=d.payload-'preferredContact'
  where (rid is null or d.request_id=rid) and d.provider_payload is null
    and d.status in('queued','retry_scheduled','provider_not_configured')
    and not dt_private.shared_contact_eligible(d);
  update dt_private.notification_deliveries d set status='suppressed',claim_token=null,claimed_at=null,
    last_error_code='recipient_revoked_or_obsolete',updated_at=now()
  where (rid is null or d.request_id=rid) and d.status in('queued','retry_scheduled','provider_not_configured')
    and (not dt_private.delivery_eligible(d) or (d.definitely_unsent
      and exists(select 1 from public.dt_request_events e where e.request_id=d.request_id and e.id>d.event_id)));
  update dt_private.notification_deliveries d set status='permanent_failure',claim_token=null,claimed_at=null,
    last_error_code='retry_budget_exhausted',updated_at=now()
  where (rid is null or d.request_id=rid) and d.status in('queued','retry_scheduled','processing')
    and (d.attempts>=6 or d.created_at<=now()-interval '24 hours')
    and (d.status<>'processing' or d.claimed_at<now()-interval '5 minutes');
  return query with candidates as (
    select d.id from dt_private.notification_deliveries d
    join dt_private.notification_channels c on c.channel=d.channel and c.enabled
    where (rid is null or d.request_id=rid) and d.channel=any(allowed_channels)
      and d.created_at>=c.activated_at and d.created_at>now()-interval '24 hours'
      and (c.recipient_allowlist is null or d.recipient_id=any(c.recipient_allowlist))
      and d.attempts<6 and dt_private.delivery_eligible(d)
      and ((d.status in('queued','retry_scheduled') and coalesce(d.next_attempt_at,'-infinity')<=now())
        or (d.status='processing' and d.claimed_at<now()-interval '5 minutes'))
    order by d.id limit least(greatest(batch_size,1),20) for update of d skip locked
  ), claimed as (
    update dt_private.notification_deliveries d set status='processing',attempts=d.attempts+1,
      claim_token=gen_random_uuid(),claimed_at=now(),attempt_started_at=null,
      next_attempt_at=null,updated_at=now()
    from candidates where d.id=candidates.id returning d.*
  ) select claimed.id,claimed.claim_token,claimed.idempotency_key,claimed.channel,
    claimed.recipient_address,claimed.template_name,claimed.payload,claimed.attempts,claimed.callback_token
  from claimed order by claimed.id;
end $$;
-- Retain the old interactive RPC shape: callback token is obtained during prepare.
create or replace function dt_private.claim_notification_deliveries(rid uuid,requested_by uuid,
  allowed_channels text[],batch_size integer default 10)
returns table(delivery_id bigint,claim_token uuid,idempotency_key text,channel text,
  recipient_address text,template_name text,payload jsonb,attempts integer)
language sql security definer set search_path='' as $$
  select d.delivery_id,d.claim_token,d.idempotency_key,d.channel,d.recipient_address,
    d.template_name,d.payload,d.attempts from dt_private.claim_notification_batch(
      rid,requested_by,allowed_channels,batch_size) d
$$;
create function public.dt_claim_notification_batch(allowed_channels text[],batch_size integer default 10)
returns table(delivery_id bigint,claim_token uuid,idempotency_key text,channel text,
  recipient_address text,template_name text,payload jsonb,attempts integer,callback_token uuid)
language sql security invoker set search_path='' as $$
  select * from dt_private.claim_notification_batch(null,null,allowed_channels,batch_size)
$$;
create function dt_private.prepare_notification(delivery bigint,lease uuid,provider_request jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d dt_private.notification_deliveries;
begin
  select * into d from dt_private.notification_deliveries where id=delivery
    and claim_token=lease and status='processing' for update;
  if d.id is null then raise exception 'Stale delivery.'; end if;
  if not dt_private.delivery_eligible(d) or (d.definitely_unsent and exists(
    select 1 from public.dt_request_events e where e.request_id=d.request_id and e.id>d.event_id))
    or not exists(select 1 from dt_private.notification_channels c
    where c.channel=d.channel and c.enabled and d.created_at>=c.activated_at
      and (c.recipient_allowlist is null or d.recipient_id=any(c.recipient_allowlist))) then
    update dt_private.notification_deliveries set status='suppressed',claim_token=null,claimed_at=null,
      last_error_code='recipient_revoked',updated_at=now() where id=d.id;
    return null;
  end if;
  if d.channel='email' then
    provider_request:=provider_request||jsonb_build_object('tags',jsonb_build_array(
      jsonb_build_object('name','dt_delivery','value',d.id::text),
      jsonb_build_object('name','dt_token','value',d.callback_token::text)));
  end if;
  update dt_private.notification_deliveries set provider_payload=coalesce(provider_payload,provider_request),
    send_started_at=coalesce(send_started_at,now()),attempt_started_at=now(),
    definitely_unsent=false where id=d.id returning * into d;
  return jsonb_build_object('body',d.provider_payload,'callbackToken',d.callback_token);
end $$;
create function public.dt_prepare_notification(delivery bigint,lease uuid,provider_request jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select dt_private.prepare_notification(delivery,lease,provider_request)
$$;

create function dt_private.delivery_callback(channel_name text,event_key text,provider_id text,
  new_status text,occurred_at timestamptz,delivery_id bigint default null,callback_token uuid default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if channel_name not in('email','whatsapp') or new_status not in('accepted','delivered','bounced','permanent_failure','suppressed')
    or length(event_key) not between 1 and 250 or length(provider_id) not between 1 and 200
    or occurred_at is null then raise exception 'Invalid delivery callback.'; end if;
  insert into dt_private.delivery_callbacks(channel,event_key,provider_reference,status,occurred_at)
    values(channel_name,event_key,provider_id,new_status,occurred_at)
    on conflict on constraint delivery_callbacks_pkey do nothing;
  if not found then return; end if;
  update dt_private.notification_deliveries d set status=new_status,
    provider_reference=provider_id,provider_event_at=occurred_at,claim_token=null,claimed_at=null,
    next_attempt_at=null,updated_at=now()
  where d.channel=channel_name and d.send_started_at is not null and
    (d.provider_reference=provider_id or (d.id=delivery_id
      and d.callback_token=delivery_callback.callback_token and d.provider_reference is null))
    and (d.provider_event_at is null or occurred_at>=d.provider_event_at)
    and (new_status<>'accepted' or d.status not in('delivered','bounced','permanent_failure','suppressed'))
    and (d.status<>'delivered' or new_status='delivered' or (channel_name='email' and new_status='bounced'));
end $$;
create function public.dt_delivery_callback(channel_name text,event_key text,provider_id text,
  new_status text,occurred_at timestamptz,delivery_id bigint default null,callback_token uuid default null)
returns void language sql security invoker set search_path='' as $$
  select dt_private.delivery_callback(channel_name,event_key,provider_id,new_status,occurred_at,delivery_id,callback_token)
$$;
create or replace function dt_private.finish_notification_delivery(delivery bigint,delivery_claim uuid,
  delivery_key text,delivery_status text,provider_id text default null,error_code text default null,
  retry_at timestamptz default null) returns void
language plpgsql security definer set search_path='' as $$
declare d dt_private.notification_deliveries; callback record;
begin
  if delivery_claim is null or delivery_status not in('provider_not_configured','accepted','delivered',
    'retry_scheduled','permanent_failure','uncertain') or length(coalesce(error_code,''))>80
    then raise exception 'Invalid notification result.'; end if;
  select * into d from dt_private.notification_deliveries where id=delivery and idempotency_key=delivery_key
    for update;
  if d.status in('accepted','delivered','bounced','permanent_failure','suppressed') and d.provider_reference=provider_id
    then return; end if; -- callback arrived before the HTTP response
  if d.claim_token is distinct from delivery_claim or d.status<>'processing'
    then raise exception 'Notification delivery is stale.'; end if;
  select * into callback from dt_private.delivery_callbacks c where c.channel=d.channel
    and c.provider_reference=provider_id order by (c.status<>'accepted') desc,
      c.occurred_at desc,(c.status='bounced') desc,(c.status='delivered') desc limit 1;
  update dt_private.notification_deliveries set status=coalesce(callback.status,case
    when delivery_status='retry_scheduled' and (attempts>=6 or created_at<=now()-interval '24 hours')
      then 'permanent_failure' else delivery_status end),
    claim_token=null,claimed_at=null,provider_reference=left(provider_id,200),
    provider_event_at=callback.occurred_at,last_error_code=nullif(error_code,''),
    definitely_unsent=case when delivery_status='retry_scheduled' and error_code='provider_429'
      then true else definitely_unsent end,
    next_attempt_at=case when delivery_status='retry_scheduled' and callback.status is null
      then greatest(coalesce(retry_at,now()+interval '1 minute'),now()+interval '1 second') end,
    updated_at=now() where id=delivery;
end $$;
revoke all on function dt_private.shared_contact_eligible(dt_private.notification_deliveries),
  dt_private.delivery_eligible(dt_private.notification_deliveries),
  dt_private.claim_notification_batch(uuid,uuid,text[],integer),public.dt_claim_notification_batch(text[],integer),
  dt_private.prepare_notification(bigint,uuid,jsonb),public.dt_prepare_notification(bigint,uuid,jsonb),
  dt_private.delivery_callback(text,text,text,text,timestamptz,bigint,uuid),
  public.dt_delivery_callback(text,text,text,text,timestamptz,bigint,uuid) from public,anon,authenticated;
grant execute on function public.dt_claim_notification_batch(text[],integer),
  dt_private.claim_notification_batch(uuid,uuid,text[],integer),
  dt_private.prepare_notification(bigint,uuid,jsonb),public.dt_prepare_notification(bigint,uuid,jsonb),
  dt_private.delivery_callback(text,text,text,text,timestamptz,bigint,uuid),
  public.dt_delivery_callback(text,text,text,text,timestamptz,bigint,uuid) to service_role;

-- Challenges contain provider references, never codes. Counts include failed sends/checks.
create table dt_private.whatsapp_challenges (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  number text not null, provider_id text, checks integer not null default 0 check(checks between 0 and 5),
  created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '10 minutes',
  verified_at timestamptz
);
create index dt_verify_account_idx on dt_private.whatsapp_challenges(user_id,created_at desc);
create index dt_verify_number_idx on dt_private.whatsapp_challenges(number,created_at desc);
alter table dt_private.whatsapp_challenges enable row level security;
revoke all on dt_private.whatsapp_challenges from public,anon,authenticated;
create function dt_private.reserve_whatsapp_verification(uid uuid,number text,challenge uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p dt_private.contact_preferences; v dt_private.whatsapp_challenges;
begin
  if uid is null or number is null or number !~ '^\+[1-9][0-9]{7,14}$'
    or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null)
    then raise exception 'Verify your email and use international number format.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,31));
  perform pg_advisory_xact_lock(hashtextextended(number,32));
  select * into p from dt_private.contact_preferences where user_id=uid for update;
  if p.whatsapp_number is distinct from number then raise exception 'Save your number first.'; end if;
  if challenge is null then
    if exists(select 1 from dt_private.whatsapp_challenges where (user_id=uid or whatsapp_challenges.number=reserve_whatsapp_verification.number)
      and created_at>now()-interval '60 seconds') then raise exception 'Wait 60 seconds before requesting another code.'; end if;
    if (select count(*) from dt_private.whatsapp_challenges where user_id=uid and created_at>now()-interval '1 hour')>=3
      or (select count(*) from dt_private.whatsapp_challenges where whatsapp_challenges.number=reserve_whatsapp_verification.number
      and created_at>now()-interval '1 hour')>=3 then raise exception 'Verification limit reached. Try again in an hour.'; end if;
    insert into dt_private.whatsapp_challenges(user_id,number) values(uid,number) returning * into v;
  else
    select * into v from dt_private.whatsapp_challenges where id=challenge and user_id=uid
      and whatsapp_challenges.number=reserve_whatsapp_verification.number for update;
    if v.id is null or v.expires_at<=now() or v.verified_at is not null or v.provider_id is null
      then raise exception 'Request a new verification code.'; end if;
    if v.checks>=5 then raise exception 'Too many code attempts. Request a new code.'; end if;
    update dt_private.whatsapp_challenges set checks=checks+1 where id=v.id;
  end if;
  return jsonb_build_object('id',v.id,'number',v.number,'providerId',v.provider_id);
end $$;
create function dt_private.finish_whatsapp_verification(challenge uuid,uid uuid,provider_id text,approved boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v dt_private.whatsapp_challenges;
begin
  perform pg_advisory_xact_lock(hashtextextended(uid::text,31));
  select * into v from dt_private.whatsapp_challenges where id=challenge and user_id=uid for update;
  if v.id is null or v.expires_at<=now() then raise exception 'Verification expired.'; end if;
  if not approved then
    update dt_private.whatsapp_challenges set provider_id=finish_whatsapp_verification.provider_id
      where id=v.id and whatsapp_challenges.provider_id is null;
  else
    if v.provider_id is distinct from provider_id or v.checks<1 then raise exception 'Verification mismatch.'; end if;
    update dt_private.contact_preferences set whatsapp_verified_at=now(),updated_at=now()
      where user_id=uid and whatsapp_number=v.number;
    if not found then raise exception 'Number changed. Verify your current number.'; end if;
    update dt_private.whatsapp_challenges set verified_at=now() where id=v.id;
  end if;
end $$;
create function public.dt_reserve_whatsapp_verification(uid uuid,number text,challenge uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
  select dt_private.reserve_whatsapp_verification(uid,number,challenge)
$$;
create function public.dt_finish_whatsapp_verification(challenge uuid,uid uuid,provider_id text,approved boolean)
returns void language sql security invoker set search_path='' as $$
  select dt_private.finish_whatsapp_verification(challenge,uid,provider_id,approved)
$$;
create table dt_private.whatsapp_inbound_events (
  event_id text primary key, received_at timestamptz not null default now()
);
alter table dt_private.whatsapp_inbound_events enable row level security;
revoke all on dt_private.whatsapp_inbound_events from public,anon,authenticated;
create function dt_private.whatsapp_stop(number text,event_id text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if number !~ '^\+[1-9][0-9]{7,14}$' or event_id !~ '^SM[0-9a-fA-F]{32}$'
    or number is null or event_id is null then raise exception 'Invalid inbound event.'; end if;
  insert into dt_private.whatsapp_inbound_events values(event_id,now()) on conflict do nothing;
  if not found then return; end if;
  update dt_private.contact_preferences set whatsapp_consent_at=null,updated_at=now() where whatsapp_number=number;
end
$$;
create function public.dt_whatsapp_stop(number text,event_id text) returns void language sql
security invoker set search_path='' as $$ select dt_private.whatsapp_stop(number,event_id) $$;
revoke all on function dt_private.reserve_whatsapp_verification(uuid,text,uuid),
  dt_private.finish_whatsapp_verification(uuid,uuid,text,boolean),
  public.dt_reserve_whatsapp_verification(uuid,text,uuid),public.dt_finish_whatsapp_verification(uuid,uuid,text,boolean),
  dt_private.whatsapp_stop(text,text),public.dt_whatsapp_stop(text,text) from public,anon,authenticated;
grant execute on function dt_private.reserve_whatsapp_verification(uuid,text,uuid),
  dt_private.finish_whatsapp_verification(uuid,uuid,text,boolean),
  public.dt_reserve_whatsapp_verification(uuid,text,uuid),public.dt_finish_whatsapp_verification(uuid,uuid,text,boolean),
  dt_private.whatsapp_stop(text,text),public.dt_whatsapp_stop(text,text) to service_role;

-- Namespaced scheduler does not touch other Zap jobs or shared Auth SMTP.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create table dt_private.notification_worker_health (
  singleton boolean primary key default true check(singleton),
  last_poll_at timestamptz, last_http_request_id bigint
);
insert into dt_private.notification_worker_health(singleton) values(true);
alter table dt_private.notification_worker_health enable row level security;
revoke all on dt_private.notification_worker_health from public,anon,authenticated;
create function dt_private.poll_notification_worker() returns void
language plpgsql security definer set search_path='' as $$
declare worker_url text; worker_key text; request_id bigint;
begin
  if not exists(select 1 from dt_private.notification_channels where enabled) then return; end if;
  select decrypted_secret into worker_url from vault.decrypted_secrets where name='dt_notification_worker_url';
  select decrypted_secret into worker_key from vault.decrypted_secrets where name='dt_notification_worker_key';
  if worker_url is null or worker_key is null then return; end if;
  select net.http_post(url:=worker_url,headers:=jsonb_build_object('Content-Type','application/json',
    'x-date-tree-worker-auth',worker_key),body:='{}'::jsonb,timeout_milliseconds:=55000) into request_id;
  update dt_private.notification_worker_health set last_poll_at=now(),last_http_request_id=request_id where singleton;
end $$;
revoke all on function dt_private.poll_notification_worker() from public,anon,authenticated;
select cron.schedule('date-tree-notifications-minute','* * * * *','select dt_private.poll_notification_worker()');

comment on table dt_private.notification_channels is
  'Separate kill switches. Set activated_at once after live delivery proof; never replay the historical setup backlog.';

-- Preserve booking locks/constraints; tighten repeat-click actor checks and keep
-- deliverable capacity separate from appointments after a service-type edit.
create or replace function dt_private.transition_request(rid uuid, operation text, expected_version integer, proposed_start timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=dt_private.actor(); r public.dt_requests; c uuid; target text; new_end timestamptz; pad interval; a jsonb;
begin
  select creator_id into c from public.dt_requests where id=rid and (creator_id=uid or requester_id=uid);
  if c is null then raise exception 'Request not found.'; end if;
  perform 1 from public.profiles_private where id=c for update;
  select * into r from public.dt_requests where id=rid for update;
  if (operation in ('accept','decline','counter','complete') and uid<>c) or (operation='accept_counter' and uid<>r.requester_id) then raise exception 'That action is not allowed for this request.'; end if;
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
    if r.snapshot->>'kind'='scheduled' then
      select x.end_at into new_end from dt_private.slots(r.service_id,(r.start_at at time zone 'UTC')::date,(r.snapshot->>'duration')::int) x where x.start_at=r.start_at limit 1;
      if new_end is null or new_end<>r.end_at then raise exception 'This appointment is no longer available. Propose another time.'; end if;
      select availability into a from dt_private.published_settings where creator_id=c;
      pad:=make_interval(mins=>(a->>'buffer')::int);
      r.reserved_from:=r.start_at-pad; r.reserved_until:=r.end_at+pad; target:='CONFIRMED';
    elsif r.snapshot->>'kind'='deliverable' then
      if (select count(*) from public.dt_requests where creator_id=c and service_id=r.service_id and status='CONFIRMED' and snapshot->>'kind'='deliverable') >= (select (definition->>'capacity')::int from public.dt_services where id=r.service_id) then raise exception 'Delivery capacity reached. Complete an existing request first.'; end if;
      target:='CONFIRMED';
    else target:='CONFIRMED'; end if;
  else raise exception 'That action is not allowed for this request.'; end if;
  update public.dt_requests set status=target,accepted_at=case when target='CONFIRMED' then coalesce(accepted_at,now()) else accepted_at end,delivery_due_at=case when target='CONFIRMED' and r.snapshot->>'kind'='deliverable' then coalesce(delivery_due_at,now()+make_interval(days=>(r.snapshot->>'turnaround')::int)) else delivery_due_at end,start_at=r.start_at,end_at=r.end_at,reserved_from=case when target='CONFIRMED' then r.reserved_from else null end,reserved_until=case when target='CONFIRMED' then r.reserved_until else null end,version=version+1,updated_at=now() where id=rid;
end $$;
