-- Additive Date Tree namespace; unrelated Zap applications are untouched.
create schema if not exists dt_private;
revoke all on schema dt_private from public;
grant usage on schema dt_private to anon, authenticated;

create extension if not exists pg_jsonschema with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- Generated structural contract from pageDocumentSchema; semantic checks follow.
create function dt_private.valid_document(d jsonb) returns boolean language sql immutable set search_path='' as $fn$
select coalesce(extensions.jsonb_matches_schema($schema${"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"profile":{"type":"object","properties":{"themeVersion":{"type":"number","const":1},"username":{"type":"string","pattern":"^[a-z0-9][a-z0-9_-]{2,29}$"},"displayName":{"type":"string","minLength":1,"maxLength":80},"bio":{"type":"string","maxLength":500},"tagline":{"type":"string","maxLength":100},"avatar":{"anyOf":[{"type":"string","pattern":"^[0-9a-f-]{36}\\/[0-9a-f-]{36}\\.png$"},{"type":"string","const":""}]},"cover":{"anyOf":[{"type":"string","pattern":"^[0-9a-f-]{36}\\/[0-9a-f-]{36}\\.png$"},{"type":"string","const":""}]},"backgroundImage":{"anyOf":[{"type":"string","pattern":"^[0-9a-f-]{36}\\/[0-9a-f-]{36}\\.png$"},{"type":"string","const":""}]},"avatarPosition":{"type":"number","minimum":0,"maximum":100},"coverPosition":{"type":"number","minimum":0,"maximum":100},"backgroundPosition":{"type":"number","minimum":0,"maximum":100},"theme":{"type":"string","enum":["dark","minimal","luxury","vibrant","soft"]},"accent":{"type":"string","pattern":"^#[0-9a-fA-F]{6}$"},"background":{"type":"string","pattern":"^#[0-9a-fA-F]{6}$"},"backgroundType":{"type":"string","enum":["solid","gradient","image"]},"gradient":{"type":"string","enum":["night","ocean","sunset"]},"font":{"type":"string","enum":["sans","serif","mono"]},"buttons":{"type":"string","enum":["pill","rounded","square"]},"cards":{"type":"string","enum":["solid","glass","outline"]},"scheme":{"type":"string","enum":["light","dark"]},"links":{"maxItems":12,"type":"array","items":{"type":"object","properties":{"label":{"type":"string","minLength":1,"maxLength":60},"url":{"type":"string","maxLength":2048,"format":"uri"}},"required":["label","url"],"additionalProperties":false}}},"required":["themeVersion","username","displayName","bio","tagline","avatar","cover","backgroundImage","avatarPosition","coverPosition","backgroundPosition","theme","accent","background","backgroundType","gradient","font","buttons","cards","scheme","links"],"additionalProperties":false},"services":{"maxItems":20,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":2,"maxLength":80},"description":{"type":"string","maxLength":1000},"kind":{"type":"string","enum":["scheduled","deliverable","enquiry"]},"active":{"type":"boolean"},"image":{"anyOf":[{"type":"string","pattern":"^[0-9a-f-]{36}\\/[0-9a-f-]{36}\\.png$"},{"type":"string","const":""}]},"pricing":{"type":"string","enum":["free","fixed","quote"]},"amount":{"type":"integer","minimum":0,"maximum":100000000},"currency":{"type":"string","enum":["ZAR","USD","GBP","EUR"]},"duration":{"type":"integer","minimum":15,"maximum":240,"multipleOf":15},"mode":{"type":"string","enum":["online","in-person"]},"location":{"type":"string","maxLength":100},"turnaround":{"type":"integer","minimum":1,"maximum":90},"capacity":{"type":"integer","minimum":1,"maximum":100},"instructions":{"type":"string","maxLength":1000},"questions":{"maxItems":3,"type":"array","items":{"type":"object","properties":{"label":{"type":"string","minLength":1,"maxLength":120},"required":{"type":"boolean"}},"required":["label","required"],"additionalProperties":false}},"privateDetails":{"type":"string","maxLength":500}},"required":["id","title","description","kind","active","image","pricing","amount","currency","duration","mode","location","turnaround","capacity","instructions","questions","privateDetails"],"additionalProperties":false}},"availability":{"type":"object","properties":{"timezone":{"type":"string","maxLength":80},"windows":{"maxItems":28,"type":"array","items":{"type":"object","properties":{"day":{"type":"integer","minimum":0,"maximum":6},"start":{"type":"string","pattern":"^([01]\\d|2[0-3]):[0-5]\\d$"},"end":{"type":"string","pattern":"^([01]\\d|2[0-3]):[0-5]\\d$"}},"required":["day","start","end"],"additionalProperties":false}},"exceptions":{"maxItems":90,"type":"array","items":{"type":"object","properties":{"date":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"windows":{"maxItems":4,"type":"array","items":{"type":"object","properties":{"day":{"type":"integer","minimum":0,"maximum":6},"start":{"type":"string","pattern":"^([01]\\d|2[0-3]):[0-5]\\d$"},"end":{"type":"string","pattern":"^([01]\\d|2[0-3]):[0-5]\\d$"}},"required":["day","start","end"],"additionalProperties":false}}},"required":["date","windows"],"additionalProperties":false}},"notice":{"type":"integer","minimum":0,"maximum":168},"horizon":{"type":"integer","minimum":1,"maximum":90},"buffer":{"type":"integer","minimum":0,"maximum":120}},"required":["timezone","windows","exceptions","notice","horizon","buffer"],"additionalProperties":false},"step":{"type":"integer","minimum":0,"maximum":3}},"required":["profile","services","availability","step"],"additionalProperties":false}$schema$::json,d),false);
$fn$;

alter table public.profiles_public add column document jsonb;
alter table public.profiles_public add column username_locked boolean not null default false;
-- All publication writes now pass through the guarded transaction below.
revoke insert, update on public.profiles_public from authenticated;

create table public.dt_page_drafts (
  creator_id uuid primary key references public.profiles_private(id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
create table public.dt_services (
  id uuid primary key,
  creator_id uuid not null references public.profiles_private(id) on delete cascade,
  definition jsonb not null,
  active boolean not null default true,
  unique (id, creator_id)
);
create index dt_services_creator_idx on public.dt_services(creator_id);
create table dt_private.published_settings (
  creator_id uuid primary key references public.profiles_private(id) on delete cascade,
  availability jsonb not null
);
create table dt_private.service_details (
  service_id uuid primary key references public.dt_services(id) on delete cascade,
  details text not null
);
alter table dt_private.published_settings enable row level security;
alter table dt_private.service_details enable row level security;
revoke all on dt_private.published_settings,dt_private.service_details from public,anon,authenticated;
create table public.dt_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles_private(id),
  service_id uuid not null,
  requester_id uuid not null references auth.users(id),
  idempotency_key uuid not null,
  snapshot jsonb not null,
  requester_name text not null check (length(requester_name) between 1 and 80),
  requester_email text not null,
  notes text not null default '' check (length(notes) <= 2000),
  answers jsonb not null default '[]' check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) <= 3),
  preferred_date date,
  start_at timestamptz,
  end_at timestamptz,
  reserved_from timestamptz,
  reserved_until timestamptz,
  visitor_timezone text not null,
  status text not null default 'PENDING_CREATOR' check (status in ('DRAFT','PENDING_CREATOR','COUNTER_PROPOSED','ACCEPTED_AWAITING_PAYMENT','CONFIRMED','DECLINED','CANCELLED','COMPLETED','EXPIRED','NO_SHOW','REFUND_PENDING','REFUNDED')),
  adult_confirmed_at timestamptz not null default now(),
  sharing_consent_at timestamptz not null default now(),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(requester_id, idempotency_key),
  foreign key(service_id, creator_id) references public.dt_services(id, creator_id),
  check ((start_at is null and end_at is null) or (start_at is not null and end_at is not null and end_at > start_at)),
  check ((reserved_from is null and reserved_until is null) or (reserved_from is not null and reserved_until is not null and reserved_until > reserved_from)),
  exclude using gist (creator_id extensions.gist_uuid_ops with =, tstzrange(reserved_from,reserved_until,'[)') with &&)
    where (status in ('CONFIRMED','ACCEPTED_AWAITING_PAYMENT') and reserved_from is not null)
);
create table dt_private.request_meeting_details (
  request_id uuid primary key references public.dt_requests(id) on delete cascade,
  details text not null
);
alter table dt_private.request_meeting_details enable row level security;
revoke all on dt_private.request_meeting_details from public,anon,authenticated;
create index dt_requests_creator_status_idx on public.dt_requests(creator_id, status, created_at desc);
create index dt_requests_requester_idx on public.dt_requests(requester_id, created_at desc);
create index dt_requests_service_idx on public.dt_requests(service_id);
create table public.dt_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.dt_requests(id) on delete cascade,
  actor_id uuid not null,
  status text not null,
  created_at timestamptz not null default now()
);
create index dt_request_events_request_idx on public.dt_request_events(request_id);
create table public.dt_notification_outbox (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.dt_requests(id) on delete cascade,
  event_id bigint not null unique references public.dt_request_events(id),
  status text not null default 'provider_not_configured',
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now()
);
create index dt_outbox_request_idx on public.dt_notification_outbox(request_id);

alter table public.dt_page_drafts enable row level security;
alter table public.dt_services enable row level security;
alter table public.dt_requests enable row level security;
alter table public.dt_request_events enable row level security;
alter table public.dt_notification_outbox enable row level security;
revoke all on public.dt_page_drafts,public.dt_services,public.dt_requests,public.dt_request_events,public.dt_notification_outbox from anon,authenticated;
grant select on public.dt_page_drafts,public.dt_services,public.dt_requests,public.dt_request_events to authenticated;
create policy dt_drafts_owner on public.dt_page_drafts for select to authenticated using (creator_id=(select auth.uid()));
create policy dt_services_owner on public.dt_services for select to authenticated using (creator_id=(select auth.uid()));
create policy dt_requests_participants on public.dt_requests for select to authenticated using (creator_id=(select auth.uid()) or requester_id=(select auth.uid()));
create policy dt_events_participants on public.dt_request_events for select to authenticated using (exists(select 1 from public.dt_requests r where r.id=request_id and (r.creator_id=(select auth.uid()) or r.requester_id=(select auth.uid()))));

-- Centralized session validation, not user-editable metadata authorization.
create function dt_private.actor() returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and u.email_confirmed_at is not null)
    or not exists(select 1 from auth.sessions s where s.id=nullif(auth.jwt()->>'session_id','')::uuid and s.user_id=uid)
  then raise exception 'Sign in with a verified email to continue.'; end if;
  return uid;
end $$;

-- Build a public projection, never copy an arbitrary document into public data.
create function dt_private.public_document(d jsonb) returns jsonb language sql immutable set search_path='' as $$
select jsonb_build_object('profile', (select jsonb_object_agg(key,value) from jsonb_each(d->'profile') where key=any(array['themeVersion','username','displayName','bio','tagline','avatar','cover','backgroundImage','avatarPosition','coverPosition','backgroundPosition','theme','accent','background','backgroundType','gradient','font','buttons','cards','scheme','links'])), 'services', coalesce((select jsonb_agg((select jsonb_object_agg(key,value) from jsonb_each(s) where key=any(array['id','title','description','kind','active','image','pricing','amount','currency','duration','mode','location','turnaround','capacity','instructions','questions']))) from jsonb_array_elements(d->'services') s where s->>'active'='true'),'[]'::jsonb));
$$;

create function dt_private.save_page(d jsonb, expected_revision integer) returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid := dt_private.actor(); p jsonb := d->'profile'; a jsonb := d->'availability'; s jsonb; w jsonb; img text; slug text := p->>'username'; current_revision integer; locked text;
begin
  if d is null or expected_revision is null or expected_revision<0 or octet_length(d::text)>100000 or not dt_private.valid_document(d) then raise exception 'Invalid page.'; end if;
  if slug is null or slug !~ '^[a-z0-9][a-z0-9_-]{2,29}$' or slug=any(array['auth','api','dashboard','requests','preview','admin','settings','signin-with-chatgpt','signout-with-chatgpt','callback','assets','media','www','help','support']) then raise exception 'Choose another username.'; end if;
  if coalesce(length(p->>'displayName'),0) not between 1 and 80 or length(p->>'bio')>500 then raise exception 'Check your name and bio.'; end if;
  if not exists(select 1 from pg_timezone_names where name=a->>'timezone') or (a->>'notice')::int not between 0 and 168 or (a->>'horizon')::int not between 1 and 90 or (a->>'buffer')::int not between 0 and 120 then raise exception 'Invalid availability settings.'; end if;
  if jsonb_array_length(a->'windows')>28 or jsonb_array_length(a->'exceptions')>90 then raise exception 'Too many availability rules.'; end if;
  if (select count(distinct value->>'date') from jsonb_array_elements(a->'exceptions'))<>jsonb_array_length(a->'exceptions') then raise exception 'Use one override per date.'; end if;
  perform (value->>'date')::date from jsonb_array_elements(a->'exceptions');
  if exists(select 1 from jsonb_array_elements(p->'links') l where l->>'url' !~ '^https://[^/@[:space:]\\]+([/:?#]|$)' or split_part(substring(l->>'url' from 9),'/',1) ~ '@') then raise exception 'Use safe HTTPS links.'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(d->'services'))<>jsonb_array_length(d->'services') then raise exception 'Services need unique identifiers.'; end if;
  for w in select value from jsonb_array_elements(a->'windows') union all select win from jsonb_array_elements(a->'exceptions') e cross join lateral jsonb_array_elements(e->'windows') win loop
    if (w->>'day')::int not between 0 and 6 or w->>'start' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or w->>'end' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or w->>'start'=w->>'end' then raise exception 'Invalid availability window.'; end if;
  end loop;
  for img in select p->>'avatar' union all select p->>'cover' union all select p->>'backgroundImage' union all select value->>'image' from jsonb_array_elements(d->'services') loop
    if coalesce(img,'')<>'' and (img !~ ('^'||uid::text||'/[0-9a-f-]{36}\.png$') or not exists(select 1 from storage.objects where bucket_id='date-tree-media' and name=img and owner_id=uid::text)) then raise exception 'Upload an image you own.'; end if;
  end loop;
  for s in select value from jsonb_array_elements(d->'services') loop
    if ((s->>'pricing'='fixed') and (s->>'amount')::int<=0) or (s->>'pricing'='quote' and s->>'kind'<>'enquiry') then raise exception 'Check your service pricing.'; end if;
    if s->>'kind' not in ('scheduled','deliverable','enquiry') or s->>'pricing' not in ('free','fixed','quote') or s->>'currency' not in ('ZAR','USD','GBP','EUR') or coalesce(length(s->>'title'),0) not between 2 and 80 or (s->>'duration')::int not between 15 and 240 or (s->>'duration')::int%15<>0 or (s->>'amount')::bigint not between 0 and 100000000 or (s->>'turnaround')::int not between 1 and 90 or (s->>'capacity')::int not between 1 and 100 or jsonb_array_length(s->'questions')>3 then raise exception 'Check your service details.'; end if;
    if exists(select 1 from public.dt_services where id=(s->>'id')::uuid and creator_id<>uid) then raise exception 'Invalid service.'; end if;
  end loop;
  -- Serialize every creator write/accept on the same row, including first save.
  perform 1 from public.profiles_private where id=uid for update;
  select revision into current_revision from public.dt_page_drafts where creator_id=uid;
  if coalesce(current_revision,0)<>expected_revision then raise exception 'This page changed in another tab. Reload before saving.'; end if;
  select username into locked from public.profiles_public where creator_id=uid and username_locked;
  if locked is not null and locked<>slug then raise exception 'Your published username is locked to keep your link working.'; end if;
  insert into public.profiles_public(creator_id,username,display_name) values(uid,slug,p->>'displayName') on conflict(creator_id) do update set username=excluded.username;
  insert into public.dt_page_drafts(creator_id,document) values(uid,d) on conflict(creator_id) do update set document=d,revision=public.dt_page_drafts.revision+1,updated_at=now() returning revision into current_revision;
  return current_revision;
end $$;

create function dt_private.publish_page(publish boolean, expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := dt_private.actor(); d jsonb; s jsonb; rev integer;
begin
  perform 1 from public.profiles_private where id=uid for update;
  select document,revision into d,rev from public.dt_page_drafts where creator_id=uid;
  if d is null or publish is null or expected_revision is null or rev<>expected_revision then raise exception 'Save or reload your page before publishing.'; end if;
  if not publish then update public.profiles_public set is_published=false,published_at=null where creator_id=uid; return; end if;
  if not exists(select 1 from public.profiles_private where id=uid and is_adult and terms_accepted_at is not null and privacy_accepted_at is not null) then raise exception 'Complete age, terms and privacy consent before publishing.'; end if;
  if not exists(select 1 from jsonb_array_elements(d->'services') s where s->>'active'='true') then raise exception 'Add an active service first.'; end if;
  if exists(select 1 from jsonb_array_elements(d->'services') s where s->>'active'='true' and s->>'kind'='scheduled') and jsonb_array_length(d#>'{availability,windows}')=0 and not exists(select 1 from jsonb_array_elements(d#>'{availability,exceptions}') e where jsonb_array_length(e->'windows')>0) then raise exception 'Set appointment availability first.'; end if;
  update public.dt_services set active=false where creator_id=uid;
  insert into dt_private.published_settings(creator_id,availability) values(uid,d->'availability') on conflict(creator_id) do update set availability=excluded.availability;
  for s in select value from jsonb_array_elements(dt_private.public_document(d)->'services') loop
    if exists(select 1 from public.dt_services where id=(s->>'id')::uuid and creator_id<>uid) then raise exception 'Invalid service identifier. Create a new service.'; end if;
    insert into public.dt_services(id,creator_id,definition,active) values((s->>'id')::uuid,uid,s,true) on conflict(id) do update set definition=excluded.definition,active=true where public.dt_services.creator_id=uid;
    if not found then raise exception 'Invalid service identifier. Create a new service.'; end if;
  end loop;
  for s in select value from jsonb_array_elements(d->'services') where value->>'active'='true' loop
    insert into dt_private.service_details(service_id,details) values((s->>'id')::uuid,s->>'privateDetails') on conflict(service_id) do update set details=excluded.details;
  end loop;
  update public.profiles_public set document=dt_private.public_document(d),display_name=d#>>'{profile,displayName}',bio=d#>>'{profile,bio}',is_published=true,published_at=now(),username_locked=true,updated_at=now() where creator_id=uid;
end $$;

-- Public slots are the only anonymous entry into private availability. UTC series
-- uses PostgreSQL's named-zone rules; ambiguous wall boundaries choose standard time.
create function dt_private.slots(service uuid, from_date date, requested_duration integer default null) returns table(start_at timestamptz,end_at timestamptz) language plpgsql security definer set search_path='' as $$
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
        -- A date override cuts off a preceding day's overnight spillover.
        and not exists(select 1 from jsonb_array_elements(a->'exceptions') other where (other->>'date')::date<>day and (other->>'date')::date between (t at time zone tz)::date and ((t+duration-interval '1 microsecond') at time zone tz)::date)
        and not exists(select 1 from public.dt_requests r where r.creator_id=c and r.status in ('CONFIRMED','ACCEPTED_AWAITING_PAYMENT') and r.reserved_from is not null and tstzrange(r.reserved_from,r.reserved_until,'[)') && tstzrange(t-pad,t+duration+pad,'[)'));
    end loop;
  end loop;
end $$;

create function dt_private.submit_request(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=dt_private.actor(); sid uuid:=(payload->>'serviceId')::uuid; c uuid; s jsonb; rid uuid; begin_at timestamptz:=nullif(payload->>'start','')::timestamptz; finish_at timestamptz; contact text; q jsonb; i integer:=0;
begin
  if payload is null or octet_length(payload::text)>20000 or jsonb_typeof(payload)<>'object' then raise exception 'Invalid request.'; end if;
  -- Requester-level lock serializes rate-limit/idempotency checks.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 19));
  select id into rid from public.dt_requests where requester_id=uid and idempotency_key=(payload->>'idempotencyKey')::uuid;
  if rid is not null then return rid; end if;
  if (select count(*) from public.dt_requests where requester_id=uid and created_at>now()-interval '1 hour')>=10 then raise exception 'Request limit reached. Please try again later.'; end if;
  select creator_id,definition into c,s from public.dt_services where id=sid and active;
  perform 1 from public.profiles_private where id=c for update;
  if c is null or c=uid or not exists(select 1 from public.profiles_public where creator_id=c and is_published) or exists(select 1 from public.profiles_private where id=c and requests_paused_at is not null) then raise exception 'This service is not accepting requests.'; end if;
  -- Re-read after taking the creator lock (publish/archive may have raced).
  select definition into s from public.dt_services where id=sid and active;
  if s is null or s is distinct from payload->'serviceSnapshot' then raise exception 'This service changed. Reload and review it before submitting.'; end if;
  if (payload->'adult') is distinct from 'true'::jsonb or (payload->'consent') is distinct from 'true'::jsonb or coalesce(length(payload->>'name'),0) not between 1 and 80 or length(payload->>'notes')>2000 or not exists(select 1 from pg_timezone_names where name=payload->>'timezone') then raise exception 'Check your details and consent.'; end if;
  if jsonb_typeof(payload->'answers') is distinct from 'array' or jsonb_array_length(payload->'answers')<>jsonb_array_length(s->'questions') or exists(select 1 from jsonb_array_elements(payload->'answers') answer where jsonb_typeof(answer)<>'string') then raise exception 'Check your answers.'; end if;
  for q in select value from jsonb_array_elements(s->'questions') loop
    if length(payload->'answers'->>i)>1000 or (q->>'required'='true' and coalesce(length(trim(payload->'answers'->>i)),0)=0) then raise exception 'Please answer the required questions.'; end if; i:=i+1;
  end loop;
  if s->>'kind'='scheduled' then
    select x.end_at into finish_at from dt_private.slots(sid,(begin_at at time zone 'UTC')::date) x where x.start_at=begin_at limit 1;
    if finish_at is null then raise exception 'That time is no longer available. Choose another.'; end if;
  else
    begin_at:=null;
    if nullif(payload->>'preferredDate','')::date<current_date then raise exception 'Choose a future delivery preference.'; end if;
  end if;
  select email into contact from auth.users where id=uid;
  insert into public.dt_requests(creator_id,service_id,requester_id,idempotency_key,snapshot,requester_name,requester_email,notes,answers,preferred_date,start_at,end_at,visitor_timezone)
    values(c,sid,uid,(payload->>'idempotencyKey')::uuid,s,payload->>'name',contact,coalesce(payload->>'notes',''),payload->'answers',nullif(payload->>'preferredDate','')::date,begin_at,finish_at,payload->>'timezone') returning id into rid;
  insert into dt_private.request_meeting_details(request_id,details) select rid,details from dt_private.service_details where service_id=sid;
  return rid;
end $$;

create function dt_private.transition_request(rid uuid, operation text, expected_version integer, proposed_start timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
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
  update public.dt_requests set status=target,start_at=r.start_at,end_at=r.end_at,reserved_from=case when target='CONFIRMED' then r.reserved_from else null end,reserved_until=case when target='CONFIRMED' then r.reserved_until else null end,version=version+1,updated_at=now() where id=rid;
end $$;

-- Defense in depth against overlapping writes, even future internal writers.
create function dt_private.request_integrity() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_private where id=new.creator_id for update;
  if new.status in ('CONFIRMED','ACCEPTED_AWAITING_PAYMENT') and new.snapshot->>'kind'='scheduled' then
    if new.reserved_from is null or new.reserved_until is null then raise exception 'Reservation required.'; end if;
    if exists(select 1 from public.dt_requests r where r.creator_id=new.creator_id and r.id<>new.id and r.status in ('CONFIRMED','ACCEPTED_AWAITING_PAYMENT') and r.reserved_from is not null and tstzrange(r.reserved_from,r.reserved_until,'[)') && tstzrange(new.reserved_from,new.reserved_until,'[)')) then raise exception 'Appointment conflict.'; end if;
  end if;
  return new;
end $$;
create trigger dt_request_integrity before insert or update on public.dt_requests for each row execute function dt_private.request_integrity();
create function dt_private.request_event() returns trigger language plpgsql security definer set search_path='' as $$
declare eid bigint;
begin
  if tg_op='INSERT' or old.version<>new.version then
    insert into public.dt_request_events(request_id,actor_id,status) values(new.id,auth.uid(),new.status) returning id into eid;
    insert into public.dt_notification_outbox(request_id,event_id) values(new.id,eid);
  end if;
  return new;
end $$;
create trigger dt_request_event after insert or update on public.dt_requests for each row execute function dt_private.request_event();

create function dt_private.request_details() returns table(request_id uuid,details text) language plpgsql security definer set search_path='' as $$
declare uid uuid:=dt_private.actor();
begin
  return query select r.id,d.details from public.dt_requests r join dt_private.request_meeting_details d on d.request_id=r.id
    where r.creator_id=uid or (r.requester_id=uid and r.status in ('CONFIRMED','COMPLETED'));
end $$;

create function dt_private.media_quota() returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=dt_private.actor();
begin
  perform pg_advisory_xact_lock(hashtextextended(uid::text,21));
  return (select count(*) from storage.objects where bucket_id='date-tree-media' and owner_id=uid::text and created_at>now()-interval '1 hour')<40
    and (select count(*) from storage.objects where bucket_id='date-tree-media' and owner_id=uid::text)<500;
end $$;

-- Invoker wrappers expose a deliberately narrow API. Definers stay unexposed.
create function public.dt_save_page(document jsonb, expected_revision integer) returns integer language sql security invoker set search_path='' as $$ select dt_private.save_page(document,expected_revision) $$;
create function public.dt_publish_page(publish boolean, expected_revision integer) returns void language sql security invoker set search_path='' as $$ select dt_private.publish_page(publish,expected_revision) $$;
create function public.dt_available_slots(service uuid, from_date date) returns table(start_at timestamptz,end_at timestamptz) language sql security invoker set search_path='' as $$ select distinct * from dt_private.slots(service,from_date) order by start_at limit 200 $$;
create function public.dt_submit_request(payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select dt_private.submit_request(payload) $$;
create function public.dt_transition_request(rid uuid, operation text, expected_version integer, proposed_start timestamptz default null) returns void language sql security invoker set search_path='' as $$ select dt_private.transition_request(rid,operation,expected_version,proposed_start) $$;
create function public.dt_request_details() returns table(request_id uuid,details text) language sql security invoker set search_path='' as $$ select * from dt_private.request_details() $$;
revoke all on all functions in schema dt_private from public,anon,authenticated;
grant execute on function dt_private.save_page(jsonb,integer),dt_private.publish_page(boolean,integer),dt_private.submit_request(jsonb),dt_private.transition_request(uuid,text,integer,timestamptz) to authenticated;
grant execute on function dt_private.slots(uuid,date,integer) to anon,authenticated;
grant execute on function dt_private.request_details(),dt_private.media_quota() to authenticated;
revoke all on function public.dt_request_details() from public,anon,authenticated;
grant execute on function public.dt_request_details() to authenticated;
revoke all on function public.dt_save_page(jsonb,integer),public.dt_publish_page(boolean,integer),public.dt_submit_request(jsonb),public.dt_transition_request(uuid,text,integer,timestamptz),public.dt_available_slots(uuid,date) from public,anon,authenticated;
grant execute on function public.dt_save_page(jsonb,integer),public.dt_publish_page(boolean,integer),public.dt_submit_request(jsonb),public.dt_transition_request(uuid,text,integer,timestamptz) to authenticated;
grant execute on function public.dt_available_slots(uuid,date) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('date-tree-media','date-tree-media',false,5242880,array['image/png']);
create policy dt_media_insert on storage.objects for insert to authenticated with check(bucket_id='date-tree-media' and (storage.foldername(name))[1]=(select auth.uid())::text and owner_id=(select auth.uid())::text and (select dt_private.media_quota()));
create policy dt_media_owner_read on storage.objects for select to authenticated using(bucket_id='date-tree-media' and owner_id=(select auth.uid())::text);
-- Only references in deliberately published snapshots can be fetched anonymously.
create policy dt_media_published_read on storage.objects for select to anon,authenticated using(bucket_id='date-tree-media' and exists(select 1 from public.profiles_public p where p.is_published and (p.document#>>'{profile,avatar}'=name or p.document#>>'{profile,cover}'=name or p.document#>>'{profile,backgroundImage}'=name or exists(select 1 from jsonb_array_elements(p.document->'services') s where s->>'image'=name))));
-- No overwrite/delete grants: replacement uses immutable names; referenced assets
-- remain valid until the creator explicitly publishes their replacement.
