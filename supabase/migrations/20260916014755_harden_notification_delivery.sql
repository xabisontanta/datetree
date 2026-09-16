-- Bind WhatsApp delivery to a verified number. The product has not previously
-- shipped an OTP verifier, so no existing verification timestamp is trusted.
update public.profiles_private
set whatsapp_verified_at = null;

update public.profiles_private
set whatsapp_notifications_consent_at = null
where whatsapp_number is null;

revoke insert, update on table public.profiles_private from authenticated;
grant insert (
  id,
  whatsapp_number,
  is_adult,
  terms_accepted_at,
  privacy_accepted_at,
  whatsapp_notifications_consent_at,
  requests_paused_at,
  updated_at
) on public.profiles_private to authenticated;
grant update (
  whatsapp_number,
  is_adult,
  terms_accepted_at,
  privacy_accepted_at,
  whatsapp_notifications_consent_at,
  requests_paused_at,
  updated_at
) on public.profiles_private to authenticated;

alter table public.profiles_private
add constraint profiles_private_whatsapp_state_check
check (
  whatsapp_number is not null
  or (
    whatsapp_verified_at is null
    and whatsapp_notifications_consent_at is null
  )
);

create function dt_private.protect_whatsapp_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.whatsapp_verified_at := null;
    new.whatsapp_notifications_consent_at := case
      when new.whatsapp_number is not null
        and new.whatsapp_notifications_consent_at is not null
      then statement_timestamp()
      else null
    end;
    return new;
  end if;

  if new.whatsapp_number is distinct from old.whatsapp_number then
    new.whatsapp_verified_at := null;
    new.whatsapp_notifications_consent_at := null;
  elsif new.whatsapp_number is null then
    new.whatsapp_verified_at := null;
    new.whatsapp_notifications_consent_at := null;
  elsif new.whatsapp_notifications_consent_at is null then
    new.whatsapp_notifications_consent_at := null;
  elsif old.whatsapp_notifications_consent_at is null then
    new.whatsapp_notifications_consent_at := statement_timestamp();
  else
    new.whatsapp_notifications_consent_at := old.whatsapp_notifications_consent_at;
  end if;

  return new;
end;
$$;

create trigger dt_protect_whatsapp_state
before insert or update on public.profiles_private
for each row execute function dt_private.protect_whatsapp_state();

revoke all on function dt_private.protect_whatsapp_state()
from public, anon, authenticated;

create function dt_private.mark_whatsapp_verified(
  profile_id uuid,
  expected_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if expected_number is null
    or expected_number !~ '^\+[1-9][0-9]{7,14}$'
  then
    raise exception 'Invalid WhatsApp number.';
  end if;

  update public.profiles_private profile
  set whatsapp_verified_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where profile.id = profile_id
    and profile.whatsapp_number = expected_number;

  if not found then
    raise exception 'WhatsApp number changed before verification completed.';
  end if;
end;
$$;

revoke all on function dt_private.mark_whatsapp_verified(uuid, text)
from public, anon, authenticated;
grant execute on function dt_private.mark_whatsapp_verified(uuid, text)
to service_role;

-- Sent accepts 1-255 letters, digits, underscores, and hyphens. Canonical keys
-- are derived from the already-unique delivery tuple and never from user input.
create function dt_private.set_notification_idempotency_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.idempotency_key := concat_ws(
    '_',
    'dt',
    new.event_id::text,
    new.recipient_role,
    new.channel
  );
  return new;
end;
$$;

create trigger dt_set_notification_idempotency_key
before insert or update of event_id, recipient_role, channel, idempotency_key
on dt_private.notification_deliveries
for each row execute function dt_private.set_notification_idempotency_key();

update dt_private.notification_deliveries
set idempotency_key = idempotency_key;

alter table dt_private.notification_deliveries
add constraint notification_deliveries_idempotency_key_format_check
check (idempotency_key ~ '^[A-Za-z0-9_-]{1,255}$');

revoke all on function dt_private.set_notification_idempotency_key()
from public, anon, authenticated;

-- A fenced lease makes interrupted work reclaimable without allowing an older
-- worker to finish a delivery after a newer worker has reclaimed it.
alter table dt_private.notification_deliveries
add column claim_token uuid,
add column claimed_at timestamptz;

update dt_private.notification_deliveries
set claim_token = gen_random_uuid(),
    claimed_at = updated_at
where status = 'processing';

alter table dt_private.notification_deliveries
add constraint notification_deliveries_processing_lease_check
check (
  (status = 'processing')
  = (claim_token is not null and claimed_at is not null)
);

drop function public.dt_claim_notification_deliveries(uuid, uuid, text[], integer);
drop function dt_private.claim_notification_deliveries(uuid, uuid, text[], integer);
drop function public.dt_finish_notification_delivery(
  bigint,
  text,
  text,
  text,
  text,
  timestamptz
);
drop function dt_private.finish_notification_delivery(
  bigint,
  text,
  text,
  text,
  text,
  timestamptz
);

create function dt_private.claim_notification_deliveries(
  rid uuid,
  requested_by uuid,
  allowed_channels text[],
  batch_size integer default 10
)
returns table(
  delivery_id bigint,
  claim_token uuid,
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
    or batch_size is null
    or not exists(
      select 1
      from public.dt_requests request
      where request.id = rid
        and requested_by in (request.creator_id, request.requester_id)
    )
  then
    raise exception 'Notification request is not authorized.';
  end if;

  update dt_private.notification_deliveries delivery
  set status = 'permanent_failure',
      claim_token = null,
      claimed_at = null,
      last_error_code = 'attempt_limit_reached',
      updated_at = statement_timestamp()
  where delivery.request_id = rid
    and delivery.status = 'processing'
    and delivery.claimed_at <= statement_timestamp() - interval '5 minutes'
    and delivery.attempts >= 20;

  return query
  with candidates as (
    select delivery.id
    from dt_private.notification_deliveries delivery
    where delivery.request_id = rid
      and delivery.channel = any(allowed_channels)
      and delivery.attempts < 20
      and (
        (
          delivery.status in (
            'provider_not_configured',
            'queued',
            'retry_scheduled'
          )
          and coalesce(delivery.next_attempt_at, '-infinity'::timestamptz)
            <= statement_timestamp()
        )
        or (
          delivery.status = 'processing'
          and delivery.claimed_at
            <= statement_timestamp() - interval '5 minutes'
        )
      )
    order by delivery.id
    limit least(greatest(batch_size, 1), 20)
    for update skip locked
  ), claimed as (
    update dt_private.notification_deliveries delivery
    set status = 'processing',
        attempts = delivery.attempts + 1,
        claim_token = gen_random_uuid(),
        claimed_at = statement_timestamp(),
        next_attempt_at = null,
        updated_at = statement_timestamp()
    from candidates
    where delivery.id = candidates.id
    returning delivery.*
  )
  select
    claimed.id,
    claimed.claim_token,
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
  delivery_claim uuid,
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
  if delivery_claim is null
    or delivery_status not in (
      'provider_not_configured',
      'accepted',
      'delivered',
      'retry_scheduled',
      'permanent_failure'
    )
    or length(coalesce(error_code, '')) > 80
  then
    raise exception 'Invalid notification result.';
  end if;

  update dt_private.notification_deliveries result
  set status = delivery_status,
      claim_token = null,
      claimed_at = null,
      provider_reference = left(provider_id, 200),
      last_error_code = nullif(left(error_code, 80), ''),
      next_attempt_at = case
        when delivery_status = 'retry_scheduled'
          then greatest(
            coalesce(retry_at, statement_timestamp() + interval '5 minutes'),
            statement_timestamp()
          )
        else null
      end,
      updated_at = statement_timestamp()
  where result.id = delivery
    and result.claim_token = delivery_claim
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
  claim_token uuid,
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
  delivery_claim uuid,
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
    delivery_claim,
    delivery_key,
    delivery_status,
    provider_id,
    error_code,
    retry_at
  );
$$;

revoke all on function
  dt_private.claim_notification_deliveries(uuid, uuid, text[], integer),
  dt_private.finish_notification_delivery(
    bigint,
    uuid,
    text,
    text,
    text,
    text,
    timestamptz
  ),
  public.dt_claim_notification_deliveries(uuid, uuid, text[], integer),
  public.dt_finish_notification_delivery(
    bigint,
    uuid,
    text,
    text,
    text,
    text,
    timestamptz
  )
from public, anon, authenticated;

grant execute on function
  dt_private.claim_notification_deliveries(uuid, uuid, text[], integer),
  dt_private.finish_notification_delivery(
    bigint,
    uuid,
    text,
    text,
    text,
    text,
    timestamptz
  ),
  public.dt_claim_notification_deliveries(uuid, uuid, text[], integer),
  public.dt_finish_notification_delivery(
    bigint,
    uuid,
    text,
    text,
    text,
    text,
    timestamptz
  )
to service_role;

comment on column dt_private.notification_deliveries.claimed_at is
  'Start of a fenced worker lease; processing rows are reclaimable after five minutes.';
