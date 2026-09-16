-- Social destinations remain in the versioned page document. This wrapper keeps
-- existing drafts valid while allowing optional custom icons and mail links.
alter function dt_private.valid_document(jsonb)
  rename to valid_document_without_custom_link_icons;

create function dt_private.valid_document(d jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with links as (
    select value as link
    from jsonb_array_elements(
      case
        when jsonb_typeof(d #> '{profile,links}') = 'array'
          then d #> '{profile,links}'
        else '[]'::jsonb
      end
    )
  ), sanitized as (
    select jsonb_set(
      d,
      '{profile,links}',
      coalesce(
        (
          select jsonb_agg(
            case
              when link ? 'url' then jsonb_set(
                link - 'icon',
                '{url}',
                to_jsonb(
                  case
                    when link ->> 'url' ~* '^mailto:'
                      then 'https://email.invalid/'
                    else link ->> 'url'
                  end
                ),
                true
              )
              else link - 'icon'
            end
          )
          from links
        ),
        '[]'::jsonb
      ),
      true
    ) as document
  )
  select coalesce(
    jsonb_typeof(d #> '{profile,links}') = 'array'
    and not exists(
      select 1
      from links
      where jsonb_typeof(link) <> 'object'
        or (
          link ? 'icon'
          and (
            jsonb_typeof(link -> 'icon') <> 'string'
            or link ->> 'icon' !~ '^(|[0-9a-f-]{36}/[0-9a-f-]{36}\.png)$'
          )
        )
        or not (
          (
            link ->> 'url' ~ '^https://[^/@[:space:]\\]+([/:?#]|$)'
            and split_part(substring(link ->> 'url' from 9), '/', 1) !~ '@'
          )
          or link ->> 'url' ~* '^mailto:[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        )
    )
    and dt_private.valid_document_without_custom_link_icons(
      (select document from sanitized)
    ),
    false
  );
$$;

revoke all on function dt_private.valid_document_without_custom_link_icons(jsonb)
  from public, anon, authenticated;
revoke all on function dt_private.valid_document(jsonb)
  from public, anon, authenticated;

create or replace function dt_private.save_page(d jsonb, expected_revision integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := dt_private.actor();
  p jsonb := d -> 'profile';
  a jsonb := d -> 'availability';
  s jsonb;
  w jsonb;
  img text;
  slug text := p ->> 'username';
  current_revision integer;
  locked text;
begin
  if d is null or expected_revision is null or expected_revision < 0
    or octet_length(d::text) > 100000 or not dt_private.valid_document(d)
  then
    raise exception 'Invalid page.';
  end if;
  if slug is null or slug !~ '^[a-z0-9][a-z0-9_-]{2,29}$'
    or slug = any(array['auth','api','dashboard','requests','preview','admin','settings','signin-with-chatgpt','signout-with-chatgpt','callback','assets','media','www','help','support'])
  then
    raise exception 'Choose another username.';
  end if;
  if coalesce(length(p ->> 'displayName'), 0) not between 1 and 80
    or length(p ->> 'bio') > 500
  then
    raise exception 'Check your name and bio.';
  end if;
  if not exists(select 1 from pg_timezone_names where name = a ->> 'timezone')
    or (a ->> 'notice')::int not between 0 and 168
    or (a ->> 'horizon')::int not between 1 and 90
    or (a ->> 'buffer')::int not between 0 and 120
  then
    raise exception 'Invalid availability settings.';
  end if;
  if jsonb_array_length(a -> 'windows') > 28
    or jsonb_array_length(a -> 'exceptions') > 90
  then
    raise exception 'Too many availability rules.';
  end if;
  if (
    select count(distinct value ->> 'date')
    from jsonb_array_elements(a -> 'exceptions')
  ) <> jsonb_array_length(a -> 'exceptions')
  then
    raise exception 'Use one override per date.';
  end if;
  perform (value ->> 'date')::date
  from jsonb_array_elements(a -> 'exceptions');
  if exists(
    select 1
    from jsonb_array_elements(p -> 'links') link
    where not (
      (
        link ->> 'url' ~ '^https://[^/@[:space:]\\]+([/:?#]|$)'
        and split_part(substring(link ->> 'url' from 9), '/', 1) !~ '@'
      )
      or link ->> 'url' ~* '^mailto:[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ) then
    raise exception 'Use safe HTTPS or email links.';
  end if;
  if (
    select count(distinct value ->> 'id')
    from jsonb_array_elements(d -> 'services')
  ) <> jsonb_array_length(d -> 'services')
  then
    raise exception 'Services need unique identifiers.';
  end if;
  for w in
    select value from jsonb_array_elements(a -> 'windows')
    union all
    select win
    from jsonb_array_elements(a -> 'exceptions') e
    cross join lateral jsonb_array_elements(e -> 'windows') win
  loop
    if (w ->> 'day')::int not between 0 and 6
      or w ->> 'start' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or w ->> 'end' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or w ->> 'start' = w ->> 'end'
    then
      raise exception 'Invalid availability window.';
    end if;
  end loop;
  for img in
    select p ->> 'avatar'
    union all select p ->> 'cover'
    union all select p ->> 'backgroundImage'
    union all select value ->> 'image' from jsonb_array_elements(d -> 'services')
    union all select value ->> 'icon' from jsonb_array_elements(p -> 'links')
  loop
    if coalesce(img, '') <> '' and (
      img !~ ('^' || uid::text || '/[0-9a-f-]{36}\.png$')
      or not exists(
        select 1
        from storage.objects
        where bucket_id = 'date-tree-media'
          and name = img
          and owner_id = uid::text
      )
    ) then
      raise exception 'Upload an image you own.';
    end if;
  end loop;
  for s in select value from jsonb_array_elements(d -> 'services')
  loop
    if ((s ->> 'pricing' = 'fixed') and (s ->> 'amount')::int <= 0)
      or (s ->> 'pricing' = 'quote' and s ->> 'kind' <> 'enquiry')
    then
      raise exception 'Check your service pricing.';
    end if;
    if s ->> 'kind' not in ('scheduled','deliverable','enquiry')
      or s ->> 'pricing' not in ('free','fixed','quote')
      or s ->> 'currency' not in ('ZAR','USD','GBP','EUR')
      or coalesce(length(s ->> 'title'), 0) not between 2 and 80
      or (s ->> 'duration')::int not between 15 and 240
      or (s ->> 'duration')::int % 15 <> 0
      or (s ->> 'amount')::bigint not between 0 and 100000000
      or (s ->> 'turnaround')::int not between 1 and 90
      or (s ->> 'capacity')::int not between 1 and 100
      or jsonb_array_length(s -> 'questions') > 3
    then
      raise exception 'Check your service details.';
    end if;
    if exists(
      select 1 from public.dt_services
      where id = (s ->> 'id')::uuid and creator_id <> uid
    ) then
      raise exception 'Invalid service.';
    end if;
  end loop;
  perform 1 from public.profiles_private where id = uid for update;
  select revision into current_revision
  from public.dt_page_drafts where creator_id = uid;
  if coalesce(current_revision, 0) <> expected_revision then
    raise exception 'This page changed in another tab. Reload before saving.';
  end if;
  select username into locked
  from public.profiles_public where creator_id = uid and username_locked;
  if locked is not null and locked <> slug then
    raise exception 'Your published username is locked to keep your link working.';
  end if;
  insert into public.profiles_public(creator_id, username, display_name)
  values(uid, slug, p ->> 'displayName')
  on conflict(creator_id) do update set username = excluded.username;
  insert into public.dt_page_drafts(creator_id, document)
  values(uid, d)
  on conflict(creator_id) do update
    set document = d,
        revision = public.dt_page_drafts.revision + 1,
        updated_at = now()
  returning revision into current_revision;
  return current_revision;
end;
$$;

revoke all on function dt_private.save_page(jsonb, integer)
  from public, anon, authenticated;
grant execute on function dt_private.save_page(jsonb, integer) to authenticated;

drop policy dt_media_published_read on storage.objects;
create policy dt_media_published_read
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'date-tree-media'
  and exists(
    select 1
    from public.profiles_public profile
    where profile.is_published
      and (
        profile.document #>> '{profile,avatar}' = name
        or profile.document #>> '{profile,cover}' = name
        or profile.document #>> '{profile,backgroundImage}' = name
        or exists(
          select 1
          from jsonb_array_elements(profile.document -> 'services') service
          where service ->> 'image' = name
        )
        or exists(
          select 1
          from jsonb_array_elements(profile.document #> '{profile,links}') link
          where link ->> 'icon' = name
        )
      )
  )
);

-- One request event can fan out to the affected participant's enabled channels.
-- Destinations stay in the private schema; participant-facing status never returns
-- an email address or phone number.
create table dt_private.notification_deliveries (
  id bigint generated always as identity primary key,
  outbox_id bigint not null references public.dt_notification_outbox(id) on delete cascade,
  request_id uuid not null references public.dt_requests(id) on delete cascade,
  event_id bigint not null references public.dt_request_events(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('creator', 'requester')),
  channel text not null check (channel in ('email', 'whatsapp')),
  recipient_address text not null check (length(recipient_address) between 3 and 320),
  template_name text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  idempotency_key text not null unique,
  status text not null default 'provider_not_configured' check (
    status in (
      'provider_not_configured',
      'queued',
      'processing',
      'accepted',
      'delivered',
      'retry_scheduled',
      'permanent_failure'
    )
  ),
  attempts integer not null default 0 check (attempts between 0 and 20),
  next_attempt_at timestamptz,
  provider_reference text,
  last_error_code text check (last_error_code is null or length(last_error_code) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, recipient_role, channel)
);
create index dt_notification_delivery_request_idx
  on dt_private.notification_deliveries(request_id, created_at desc);
create index dt_notification_delivery_retry_idx
  on dt_private.notification_deliveries(status, next_attempt_at)
  where status in ('provider_not_configured', 'queued', 'retry_scheduled');
alter table dt_private.notification_deliveries enable row level security;
revoke all on dt_private.notification_deliveries from public, anon, authenticated;

create function dt_private.queue_notification(outbox bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data record;
  initial_event boolean;
  message_template text;
  message_payload jsonb;
begin
  select
    o.id as outbox_id,
    o.request_id,
    o.event_id,
    e.actor_id,
    e.status,
    r.creator_id,
    r.requester_id,
    r.requester_email,
    r.snapshot,
    coalesce(p.display_name, 'Your creator') as creator_name
  into row_data
  from public.dt_notification_outbox o
  join public.dt_request_events e on e.id = o.event_id
  join public.dt_requests r on r.id = o.request_id
  left join public.profiles_public p on p.creator_id = r.creator_id
  where o.id = outbox;

  if row_data.outbox_id is null then
    return;
  end if;

  select not exists(
    select 1
    from public.dt_request_events earlier
    where earlier.request_id = row_data.request_id
      and earlier.id < row_data.event_id
  ) into initial_event;

  message_payload := jsonb_build_object(
    'creatorName', row_data.creator_name,
    'serviceName', row_data.snapshot ->> 'title',
    'requestReference', left(row_data.request_id::text, 8),
    'status', row_data.status,
    'nextStep', case row_data.status
      when 'PENDING_CREATOR' then 'The creator will review this request.'
      when 'COUNTER_PROPOSED' then 'Review the proposed time in Date Tree.'
      when 'CONFIRMED' then 'Open Date Tree for the confirmed details and next step.'
      when 'DECLINED' then 'The request was declined. No payment was taken.'
      when 'CANCELLED' then 'The request was cancelled.'
      when 'COMPLETED' then 'The creator marked this request complete.'
      else 'Open Date Tree to review the latest status.'
    end
  );

  with recipients as (
    select
      'requester'::text as recipient_role,
      'email'::text as channel,
      row_data.requester_email::text as address
    union all
    select 'creator', 'email', creator.email
    from auth.users creator
    where creator.id = row_data.creator_id and creator.email is not null
    union all
    select 'requester', 'whatsapp', requester.whatsapp_number
    from public.profiles_private requester
    where requester.id = row_data.requester_id
      and requester.whatsapp_number is not null
      and requester.whatsapp_verified_at is not null
      and requester.whatsapp_notifications_consent_at is not null
    union all
    select 'creator', 'whatsapp', creator.whatsapp_number
    from public.profiles_private creator
    where creator.id = row_data.creator_id
      and creator.whatsapp_number is not null
      and creator.whatsapp_verified_at is not null
      and creator.whatsapp_notifications_consent_at is not null
  ), affected as (
    select *
    from recipients recipient
    where initial_event
      or (
        row_data.actor_id = row_data.creator_id
        and recipient.recipient_role = 'requester'
      )
      or (
        row_data.actor_id = row_data.requester_id
        and recipient.recipient_role = 'creator'
      )
      or row_data.actor_id not in (row_data.creator_id, row_data.requester_id)
  )
  insert into dt_private.notification_deliveries(
    outbox_id,
    request_id,
    event_id,
    recipient_role,
    channel,
    recipient_address,
    template_name,
    payload,
    idempotency_key
  )
  select
    row_data.outbox_id,
    row_data.request_id,
    row_data.event_id,
    affected.recipient_role,
    affected.channel,
    affected.address,
    case
      when initial_event and affected.recipient_role = 'requester'
        then 'REQUEST_RECEIVED'
      when row_data.status = 'PENDING_CREATOR' then 'NEW_BOOKING_REQUEST'
      when row_data.status = 'COUNTER_PROPOSED' then 'COUNTER_OFFER'
      when row_data.status = 'CONFIRMED' then 'BOOKING_CONFIRMED'
      when row_data.status = 'DECLINED' then 'BOOKING_DECLINED'
      when row_data.status = 'CANCELLED' then 'BOOKING_CANCELLED'
      when row_data.status = 'COMPLETED' then 'BOOKING_COMPLETED'
      else 'BOOKING_STATUS_UPDATED'
    end,
    message_payload || jsonb_build_object(
      'recipientRole', affected.recipient_role,
      'actionPath', case
        when affected.recipient_role = 'creator'
          then '/dashboard/requests'
        else '/requests'
      end
    ),
    'dt:' || row_data.event_id::text || ':' || affected.recipient_role || ':' || affected.channel
  from affected
  where affected.address is not null and length(affected.address) between 3 and 320
  on conflict(event_id, recipient_role, channel) do nothing;
end;
$$;

create function dt_private.queue_notification_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform dt_private.queue_notification(new.id);
  return new;
end;
$$;
create trigger dt_queue_notification_deliveries
after insert on public.dt_notification_outbox
for each row execute function dt_private.queue_notification_trigger();

-- Backfill safe delivery intents for requests that existed before this migration.
select dt_private.queue_notification(id)
from public.dt_notification_outbox
order by id;

create function dt_private.notification_statuses()
returns table(
  request_id uuid,
  event_id bigint,
  recipient_role text,
  channel text,
  template_name text,
  status text,
  attempts integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := dt_private.actor();
begin
  return query
  select
    delivery.request_id,
    delivery.event_id,
    delivery.recipient_role,
    delivery.channel,
    delivery.template_name,
    delivery.status,
    delivery.attempts,
    delivery.updated_at
  from dt_private.notification_deliveries delivery
  join public.dt_requests request on request.id = delivery.request_id
  where (
      request.creator_id = uid and delivery.recipient_role = 'creator'
    ) or (
      request.requester_id = uid and delivery.recipient_role = 'requester'
    )
  order by delivery.event_id desc, delivery.channel;
end;
$$;

create function public.dt_notification_statuses()
returns table(
  request_id uuid,
  event_id bigint,
  recipient_role text,
  channel text,
  template_name text,
  status text,
  attempts integer,
  updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from dt_private.notification_statuses();
$$;

create function dt_private.claim_notification_deliveries(
  rid uuid,
  requested_by uuid,
  allowed_channels text[],
  batch_size integer default 10
)
returns table(
  delivery_id bigint,
  idempotency_key text,
  channel text,
  recipient_address text,
  template_name text,
  payload jsonb,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if rid is null or requested_by is null or allowed_channels is null
    or not exists(
      select 1
      from public.dt_requests request
      where request.id = rid
        and requested_by in (request.creator_id, request.requester_id)
    )
  then
    raise exception 'Notification request is not authorized.';
  end if;

  return query
  with candidates as (
    select delivery.id
    from dt_private.notification_deliveries delivery
    where delivery.request_id = rid
      and delivery.channel = any(allowed_channels)
      and delivery.status in (
        'provider_not_configured',
        'queued',
        'retry_scheduled'
      )
      and coalesce(delivery.next_attempt_at, '-infinity'::timestamptz) <= now()
      and delivery.attempts < 20
    order by delivery.id
    limit least(greatest(batch_size, 1), 20)
    for update skip locked
  ), claimed as (
    update dt_private.notification_deliveries delivery
    set status = 'processing',
        attempts = delivery.attempts + 1,
        updated_at = now()
    from candidates
    where delivery.id = candidates.id
    returning delivery.*
  )
  select
    claimed.id,
    claimed.idempotency_key,
    claimed.channel,
    claimed.recipient_address,
    claimed.template_name,
    claimed.payload,
    claimed.attempts
  from claimed
  order by claimed.id;
end;
$$;

create function dt_private.finish_notification_delivery(
  delivery bigint,
  delivery_key text,
  delivery_status text,
  provider_id text default null,
  error_code text default null,
  retry_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if delivery_status not in (
    'provider_not_configured',
    'accepted',
    'delivered',
    'retry_scheduled',
    'permanent_failure'
  ) or length(coalesce(error_code, '')) > 80
  then
    raise exception 'Invalid notification result.';
  end if;

  update dt_private.notification_deliveries result
  set status = delivery_status,
      provider_reference = left(provider_id, 200),
      last_error_code = nullif(left(error_code, 80), ''),
      next_attempt_at = case
        when delivery_status = 'retry_scheduled'
          then greatest(coalesce(retry_at, now() + interval '5 minutes'), now())
        else null
      end,
      updated_at = now()
  where result.id = delivery
    and result.idempotency_key = delivery_key
    and result.status = 'processing';

  if not found then
    raise exception 'Notification delivery is stale.';
  end if;
end;
$$;

create function public.dt_claim_notification_deliveries(
  rid uuid,
  requested_by uuid,
  allowed_channels text[],
  batch_size integer default 10
)
returns table(
  delivery_id bigint,
  idempotency_key text,
  channel text,
  recipient_address text,
  template_name text,
  payload jsonb,
  attempts integer
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from dt_private.claim_notification_deliveries(
    rid,
    requested_by,
    allowed_channels,
    batch_size
  );
$$;

create function public.dt_finish_notification_delivery(
  delivery bigint,
  delivery_key text,
  delivery_status text,
  provider_id text default null,
  error_code text default null,
  retry_at timestamptz default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select dt_private.finish_notification_delivery(
    delivery,
    delivery_key,
    delivery_status,
    provider_id,
    error_code,
    retry_at
  );
$$;

revoke all on function dt_private.queue_notification(bigint),
  dt_private.queue_notification_trigger(),
  dt_private.notification_statuses(),
  dt_private.claim_notification_deliveries(uuid, uuid, text[], integer),
  dt_private.finish_notification_delivery(bigint, text, text, text, text, timestamptz)
from public, anon, authenticated;
revoke all on function public.dt_notification_statuses(),
  public.dt_claim_notification_deliveries(uuid, uuid, text[], integer),
  public.dt_finish_notification_delivery(bigint, text, text, text, text, timestamptz)
from public, anon, authenticated;

grant execute on function dt_private.notification_statuses(),
  public.dt_notification_statuses()
to authenticated;
grant usage on schema dt_private to service_role;
grant execute on function
  dt_private.claim_notification_deliveries(uuid, uuid, text[], integer),
  dt_private.finish_notification_delivery(bigint, text, text, text, text, timestamptz),
  public.dt_claim_notification_deliveries(uuid, uuid, text[], integer),
  public.dt_finish_notification_delivery(bigint, text, text, text, text, timestamptz)
to service_role;
