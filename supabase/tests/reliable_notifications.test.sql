-- Synthetic identities and provider callbacks only; no messages are sent.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create temporary table dt_test_results(result text);
grant select,insert on dt_test_results to authenticated,anon,service_role;
create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(n),
    'role','authenticated','session_id',pg_temp.uid(n))::text,true)::text
$$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select pg_temp.uid(n),'dt-notification-test-'||n||'@example.test',now(),'{}'::jsonb from generate_series(1,3) n;
insert into auth.sessions(id,user_id,created_at,updated_at) select pg_temp.uid(n),pg_temp.uid(n),now(),now() from generate_series(1,3) n;
insert into public.profiles_private(id,is_adult,terms_accepted_at,privacy_accepted_at)
values(pg_temp.uid(1),true,now(),now());
insert into public.profiles_public(creator_id,username,display_name,is_published,published_at)
values(pg_temp.uid(1),'dt-notification-test-creator','Test creator',true,now());
insert into public.dt_services(id,creator_id,definition) values(pg_temp.uid(10),pg_temp.uid(1),
  jsonb_build_object('id',pg_temp.uid(10),'title','Test enquiry','kind','enquiry','questions','[]'::jsonb,
  'duration',30,'turnaround',7,'capacity',2,'active',true));
create function pg_temp.payload(n int,contact text default 'email') returns jsonb language sql as $$
  select jsonb_build_object('serviceId',pg_temp.uid(10),'serviceSnapshot',jsonb_build_object(
    'id',pg_temp.uid(10),'title','Test enquiry','kind','enquiry','questions','[]'::jsonb,
    'duration',30,'turnaround',7,'capacity',2,'active',true),
    'idempotencyKey',pg_temp.uid(n),'name','Test fan','notes','PRIVATE TEST NOTE','answers','[]'::jsonb,
    'start','','preferredDate','','timezone','UTC','adult',true,'consent',true,
    'preferredContact',contact,'contactSharingConsent',true,'whatsappNotificationConsent',false)
$$;
insert into dt_test_results select ok(not has_column_privilege('authenticated','public.dt_requests','requester_email','SELECT'),'raw unselected email has no Data API grant');
insert into dt_test_results select ok(not has_column_privilege('authenticated','public.dt_requests','preferred_contact_address','SELECT'),'shared address is available only through the authorized contact DTO');
insert into dt_test_results select ok(not has_table_privilege('authenticated','dt_private.contact_preferences','SELECT'),'preferences are not directly readable');
insert into dt_test_results select ok(not has_function_privilege('authenticated','public.dt_reserve_whatsapp_verification(uuid,text,uuid)','EXECUTE'),'browser cannot invoke privileged verification allocator');
insert into dt_test_results select ok(not has_function_privilege('anon','public.dt_delivery_callback(text,text,text,text,timestamptz,bigint,uuid)','EXECUTE'),'browser cannot forge delivery callback');
insert into dt_test_results select has_index('dt_private','activity_reads','dt_activity_reads_request_idx',
  array['request_id'],'activity read request foreign key has a covering index');
insert into dt_test_results select has_index('dt_private','notification_deliveries','dt_notification_delivery_recipient_idx',
  array['recipient_id'],'delivery recipient foreign key has a covering index');
select pg_temp.login(2);
set local role authenticated;
insert into dt_test_results select throws_ok($$select public.dt_submit_request(pg_temp.payload(11)-'contactSharingConsent')$$,'P0001',null,'submission requires explicit contact sharing consent');
insert into dt_test_results select throws_ok($$select public.dt_submit_request(pg_temp.payload(11,'whatsapp'))$$,'P0001',null,'unverified WhatsApp is not shareable');
select public.dt_set_contact_preferences('+27656193001',false);
insert into dt_test_results select throws_ok($$select public.dt_set_contact_preferences('+27656193001',true)$$,'P0001',null,'unverified number cannot opt in');
reset role;
select set_config('dt.challenge',public.dt_reserve_whatsapp_verification(pg_temp.uid(2),'+27656193001')->>'id',true);
select public.dt_finish_whatsapp_verification(current_setting('dt.challenge')::uuid,pg_temp.uid(2),'VEtest',false);
insert into dt_test_results select throws_ok($$select public.dt_reserve_whatsapp_verification(pg_temp.uid(2),'+27656193001')$$,'P0001',null,'60 second resend cooldown applies');
select public.dt_reserve_whatsapp_verification(pg_temp.uid(2),'+27656193001',current_setting('dt.challenge')::uuid);
select public.dt_finish_whatsapp_verification(current_setting('dt.challenge')::uuid,pg_temp.uid(2),'VEtest',true);
insert into dt_test_results select is((select count(*)::int from public.profiles_private where id=pg_temp.uid(2)),0,'WhatsApp verification never creates a creator profile');
select pg_temp.login(2);
set local role authenticated;
select public.dt_set_contact_preferences('+27656193001',true);
select set_config('dt.request',public.dt_submit_request(pg_temp.payload(11,'whatsapp'))::text,true);
insert into dt_test_results select throws_ok($$select requester_email from public.dt_requests where id=current_setting('dt.request')::uuid$$,'42501',null,'raw contact column cannot be read through a different API');
insert into dt_test_results select is((select count(*)::int from public.dt_notification_feed(current_setting('dt.request')::uuid) where unread),1,'requester sees unread activity');
reset role;
select pg_temp.login(1);
set local role authenticated;
insert into dt_test_results select is((select kind from public.dt_request_contacts() where request_id=current_setting('dt.request')::uuid),'whatsapp','creator sees only selected verified WhatsApp');
insert into dt_test_results select throws_ok($$select public.dt_revoke_request_contact(current_setting('dt.request')::uuid)$$,'P0001',null,'creator cannot change requester sharing choice');
insert into dt_test_results select lives_ok($$select public.dt_transition_request(current_setting('dt.request')::uuid,'accept',1)$$,'creator can accept without a payment integration');
insert into dt_test_results select lives_ok($$select public.dt_transition_request(current_setting('dt.request')::uuid,'accept',1)$$,'repeat creator action remains idempotent');
reset role;
select pg_temp.login(2);
set local role authenticated;
insert into dt_test_results select throws_ok($$select public.dt_transition_request(current_setting('dt.request')::uuid,'accept',1)$$,'P0001',null,'wrong actor cannot exploit repeat-click handling');
select public.dt_mark_activity_read(current_setting('dt.request')::uuid,
  (select max(event_id) from public.dt_notification_feed(current_setting('dt.request')::uuid)));
insert into dt_test_results select is((select count(*)::int from public.dt_notification_feed(current_setting('dt.request')::uuid) where unread),0,'opening request marks through the viewed event read');
select public.dt_set_contact_preferences('+27656193002',false);
insert into dt_test_results select ok(not(public.dt_contact_settings()->>'whatsappVerified')::boolean
  and not(public.dt_contact_settings()->>'whatsappConsent')::boolean,'number change invalidates verification and notification permission');
reset role;
select pg_temp.login(1);
set local role authenticated;
insert into dt_test_results select is((select count(*)::int from public.dt_request_contacts() where request_id=current_setting('dt.request')::uuid),0,'old verified number disappears from contact DTO after number changes');
reset role;
select pg_temp.login(3);
set local role authenticated;
insert into dt_test_results select is((select count(*)::int from public.dt_notification_feed(current_setting('dt.request')::uuid)),0,'unrelated account cannot read request activity');
insert into dt_test_results select throws_ok($$select public.dt_mark_activity_read(current_setting('dt.request')::uuid,1)$$,'P0001',null,'unrelated account cannot mark activity read');
reset role;

-- Notification tests operate on these fixtures only and roll back channel activation.
update dt_private.notification_channels set enabled=true,activated_at=now()-interval '1 minute' where channel='email';
update dt_private.notification_deliveries set status='queued' where request_id=current_setting('dt.request')::uuid;
select set_config('dt.claim',(
  select to_jsonb(d)::text from public.dt_claim_notification_batch(array['email'],20) d
  where d.payload->>'recipientRole'='requester' and d.payload->>'status'='CONFIRMED' limit 1),true);
insert into dt_test_results select ok(current_setting('dt.claim')::jsonb->>'claim_token' is not null,'scheduler claims without browser identity');
select public.dt_prepare_notification((current_setting('dt.claim')::jsonb->>'delivery_id')::bigint,
  (current_setting('dt.claim')::jsonb->>'claim_token')::uuid,'{"subject":"immutable test"}'::jsonb);
insert into dt_test_results select is(public.dt_prepare_notification((current_setting('dt.claim')::jsonb->>'delivery_id')::bigint,
  (current_setting('dt.claim')::jsonb->>'claim_token')::uuid,'{"subject":"changed"}'::jsonb)->'body',
  jsonb_build_object('subject','immutable test','tags',jsonb_build_array(
    jsonb_build_object('name','dt_delivery','value',current_setting('dt.claim')::jsonb->>'delivery_id'),
    jsonb_build_object('name','dt_token','value',current_setting('dt.claim')::jsonb->>'callback_token'))),
  'Resend retries retain the exact immutable provider payload and correlation tags');
select public.dt_finish_notification_delivery((current_setting('dt.claim')::jsonb->>'delivery_id')::bigint,
  (current_setting('dt.claim')::jsonb->>'claim_token')::uuid,current_setting('dt.claim')::jsonb->>'idempotency_key','accepted','email-test-id');
select public.dt_delivery_callback('email','event-delivered','email-test-id','delivered',now());
select public.dt_delivery_callback('email','event-delivered','email-test-id','delivered',now());
select public.dt_delivery_callback('email','event-older','email-test-id','accepted',now()-interval '1 minute');
insert into dt_test_results select is((select status from dt_private.notification_deliveries where provider_reference='email-test-id'),'delivered','duplicate and out-of-order callbacks do not downgrade delivery');
insert into dt_test_results select is((select count(*)::int from dt_private.delivery_callbacks where channel='email' and event_key='event-delivered'),1,'duplicate event is processed once');
insert into dt_test_results select is((select status from public.dt_requests where id=current_setting('dt.request')::uuid),'CONFIRMED','delivery callback never changes business status');
select pg_temp.login(2);
set local role authenticated;
insert into dt_test_results select is((select count(*)::int from public.dt_notification_feed(current_setting('dt.request')::uuid) where unread),0,'delivery webhook does not alter inbox read state');
reset role;
-- New pending notice for explicit revoke/suppression testing.
select pg_temp.login(2);
set local role authenticated;
select set_config('dt.request2',public.dt_submit_request(pg_temp.payload(12))::text,true);
select public.dt_revoke_request_contact(current_setting('dt.request2')::uuid);
reset role;
select count(*) from public.dt_claim_notification_batch(array['email'],20);
insert into dt_test_results select ok(exists(select 1 from dt_private.notification_deliveries
  where request_id=current_setting('dt.request2')::uuid and recipient_role='creator'
    and status='processing' and payload->'preferredContact' is null),
  'revoked contact is redacted from an unprepared creator notice without losing the notice');
select pg_temp.login(1);
set local role authenticated;
insert into dt_test_results select is((select count(*)::int from public.dt_request_contacts() where request_id=current_setting('dt.request2')::uuid),0,'contact revocation removes contact API access');
reset role;
-- Abuse limits are per account AND number, not per creator profile.
update dt_private.whatsapp_challenges set created_at=now()-interval '2 minutes' where user_id=pg_temp.uid(2);
select public.dt_reserve_whatsapp_verification(pg_temp.uid(2),'+27656193002');
update dt_private.whatsapp_challenges set created_at=now()-interval '2 minutes' where user_id=pg_temp.uid(2);
select public.dt_reserve_whatsapp_verification(pg_temp.uid(2),'+27656193002');
update dt_private.whatsapp_challenges set created_at=now()-interval '2 minutes' where user_id=pg_temp.uid(2);
insert into dt_test_results select throws_ok($$select public.dt_reserve_whatsapp_verification(pg_temp.uid(2),'+27656193002')$$,
  'P0001','Verification limit reached. Try again in an hour.','three hourly sends per account are enforced');
select pg_temp.login(3);
set local role authenticated;
select public.dt_set_contact_preferences('+27656193002',false);
reset role;
select set_config('dt.challenge3',public.dt_reserve_whatsapp_verification(pg_temp.uid(3),'+27656193002')->>'id',true);
select public.dt_finish_whatsapp_verification(current_setting('dt.challenge3')::uuid,pg_temp.uid(3),'VEtest3',false);
select public.dt_reserve_whatsapp_verification(pg_temp.uid(3),'+27656193002',current_setting('dt.challenge3')::uuid) from generate_series(1,5);
insert into dt_test_results select throws_ok($$select public.dt_reserve_whatsapp_verification(pg_temp.uid(3),'+27656193002',current_setting('dt.challenge3')::uuid)$$,
  'P0001','Too many code attempts. Request a new code.','five code checks per challenge are enforced');
update dt_private.whatsapp_challenges set created_at=now()-interval '2 minutes' where number='+27656193002';
select pg_temp.login(1);
set local role authenticated;
select public.dt_set_contact_preferences('+27656193002',false);
reset role;
insert into dt_test_results select throws_ok($$select public.dt_reserve_whatsapp_verification(pg_temp.uid(1),'+27656193002')$$,
  'P0001','Verification limit reached. Try again in an hour.','number hourly limit cannot be bypassed with another account');
-- Opt-out clears notification consent independently from verification.
insert into dt_private.contact_preferences(user_id,whatsapp_number,whatsapp_verified_at,whatsapp_consent_at)
values(pg_temp.uid(2),'+27656193002',now(),now()) on conflict(user_id) do update set whatsapp_verified_at=now(),whatsapp_consent_at=now();
select public.dt_whatsapp_stop('+27656193002','SM00000000000000000000000000000001');
insert into dt_test_results select ok((select whatsapp_consent_at is null and whatsapp_verified_at is not null
  from dt_private.contact_preferences where user_id=pg_temp.uid(2)),'STOP disables notifications without forging or dropping verification');
update dt_private.contact_preferences set whatsapp_consent_at=now() where user_id=pg_temp.uid(2);
select public.dt_whatsapp_stop('+27656193002','SM00000000000000000000000000000001');
insert into dt_test_results select ok((select whatsapp_consent_at is not null
  from dt_private.contact_preferences where user_id=pg_temp.uid(2)),'a duplicate STOP cannot revoke a later opt-in');
-- A worker crash after a WhatsApp POST is held, never reclaimed for another POST.
insert into dt_private.notification_deliveries(outbox_id,request_id,event_id,recipient_id,recipient_role,channel,
  recipient_address,template_name,payload,idempotency_key,status,attempts,claim_token,claimed_at,send_started_at,attempt_started_at)
select o.id,o.request_id,o.event_id,pg_temp.uid(2),'requester','whatsapp','+27656193002','REQUEST_RECEIVED',
  '{}'::jsonb,'ignored','processing',1,gen_random_uuid(),now()-interval '6 minutes',now()-interval '7 minutes',now()-interval '7 minutes'
from public.dt_notification_outbox o where o.request_id=current_setting('dt.request2')::uuid order by o.id desc limit 1;
select count(*) from public.dt_claim_notification_batch(array['whatsapp'],20);
insert into dt_test_results select is((select status from dt_private.notification_deliveries
  where request_id=current_setting('dt.request2')::uuid and channel='whatsapp'),'uncertain','expired post-send WhatsApp lease becomes uncertain instead of resending');
update dt_private.notification_deliveries set attempts=6,status='queued',claim_token=null,claimed_at=null
where request_id=current_setting('dt.request2')::uuid and channel='email' and recipient_role='requester';
select count(*) from public.dt_claim_notification_batch(array['email'],20);
insert into dt_test_results select is((select status from dt_private.notification_deliveries
  where request_id=current_setting('dt.request2')::uuid and channel='email' and recipient_role='requester'),
  'permanent_failure','six total attempts stop delivery');
update dt_private.notification_deliveries set attempts=0,status='queued',created_at=now()-interval '25 hours'
where request_id=current_setting('dt.request2')::uuid and channel='email' and recipient_role='requester';
select count(*) from public.dt_claim_notification_batch(array['email'],20);
insert into dt_test_results select is((select status from dt_private.notification_deliveries
  where request_id=current_setting('dt.request2')::uuid and channel='email' and recipient_role='requester'),
  'permanent_failure','24 hour idempotency window bounds retries');
insert into dt_test_results select ok(exists(select 1 from cron.job where jobname='date-tree-notifications-minute' and schedule='* * * * *'),'namespaced every-minute job is installed');

-- A temporary kill switch pauses post-activation events rather than dropping them.
update dt_private.notification_channels set enabled=false where channel='email';
select pg_temp.login(2);
set local role authenticated;
select set_config('dt.request3',public.dt_submit_request(pg_temp.payload(13))::text,true);
reset role;
insert into dt_test_results select is((select count(*)::int from dt_private.notification_deliveries
  where request_id=current_setting('dt.request3')::uuid and status='queued'),2,
  'events during a post-activation pause remain queued');
select count(*) from public.dt_claim_notification_batch(array['email'],20);
insert into dt_test_results select is((select count(*)::int from dt_private.notification_deliveries
  where request_id=current_setting('dt.request3')::uuid and status='processing'),0,'kill switch blocks claims');
update dt_private.notification_channels set enabled=true where channel='email';
select set_config('dt.claim3', (select to_jsonb(d)::text
  from public.dt_claim_notification_batch(array['email'],20) d
  where d.payload->>'recipientRole'='creator' and d.payload->>'actionPath'='/dashboard/requests/'||current_setting('dt.request3') limit 1),true);
select public.dt_prepare_notification((current_setting('dt.claim3')::jsonb->>'delivery_id')::bigint,
  (current_setting('dt.claim3')::jsonb->>'claim_token')::uuid,'{"subject":"old status"}');
select public.dt_finish_notification_delivery((current_setting('dt.claim3')::jsonb->>'delivery_id')::bigint,
  (current_setting('dt.claim3')::jsonb->>'claim_token')::uuid,current_setting('dt.claim3')::jsonb->>'idempotency_key',
  'retry_scheduled',null,'provider_429',now()-interval '1 second');
select pg_temp.login(1);
set local role authenticated;
select public.dt_transition_request(current_setting('dt.request3')::uuid,'accept',1);
reset role;
select set_config('dt.receipt3',(select to_jsonb(d)::text from public.dt_claim_notification_batch(array['email'],20) d
  where d.payload->>'status'='CONFIRMED' and d.payload->>'actionPath'='/requests/'||current_setting('dt.request3') limit 1),true);
insert into dt_test_results select is((select status from dt_private.notification_deliveries
  where id=(current_setting('dt.claim3')::jsonb->>'delivery_id')::bigint),'suppressed',
  'definitely rejected 429 notice is suppressed when its request status becomes obsolete');
select public.dt_prepare_notification((current_setting('dt.receipt3')::jsonb->>'delivery_id')::bigint,
  (current_setting('dt.receipt3')::jsonb->>'claim_token')::uuid,'{"subject":"crashed email"}');
-- Provider accepted, worker response was lost: signed tags correlate without a persisted ID.
select public.dt_delivery_callback('email','event-crash-delivered','email-crash-id','delivered',now(),
  (current_setting('dt.receipt3')::jsonb->>'delivery_id')::bigint,
  (current_setting('dt.receipt3')::jsonb->>'callback_token')::uuid);
insert into dt_test_results select is((select status from dt_private.notification_deliveries
  where id=(current_setting('dt.receipt3')::jsonb->>'delivery_id')::bigint),'delivered',
  'signed email correlation reconciles a provider send even when the HTTP response is lost');

select pg_temp.login(2);
set local role authenticated;
select set_config('dt.request4',public.dt_submit_request(pg_temp.payload(14))::text,true);
reset role;
select set_config('dt.receipt4',(select to_jsonb(d)::text from public.dt_claim_notification_batch(array['email'],20) d
  where d.payload->>'actionPath'='/requests/'||current_setting('dt.request4') limit 1),true);
select public.dt_prepare_notification((current_setting('dt.receipt4')::jsonb->>'delivery_id')::bigint,
  (current_setting('dt.receipt4')::jsonb->>'claim_token')::uuid,'{"subject":"ordering"}');
select public.dt_finish_notification_delivery((current_setting('dt.receipt4')::jsonb->>'delivery_id')::bigint,
  (current_setting('dt.receipt4')::jsonb->>'claim_token')::uuid,current_setting('dt.receipt4')::jsonb->>'idempotency_key','accepted','email-order-id');
select public.dt_delivery_callback('email','event-failed-first','email-order-id','permanent_failure',now());
select public.dt_delivery_callback('email','event-delivered-newer','email-order-id','delivered',now()+interval '2 seconds');
select public.dt_delivery_callback('email','event-failed-older','email-order-id','permanent_failure',now()-interval '2 seconds');
insert into dt_test_results select is((select status from dt_private.notification_deliveries where provider_reference='email-order-id'),
  'delivered','newer delivery reconciles an earlier failure and older failure cannot downgrade it');

update dt_private.notification_channels set enabled=true,activated_at=now()-interval '1 minute' where channel='whatsapp';
select pg_temp.login(2);
set local role authenticated;
select set_config('dt.request5',public.dt_submit_request(pg_temp.payload(15)||'{"whatsappNotificationConsent":true}'::jsonb)::text,true);
reset role;
select set_config('dt.wa5',(select to_jsonb(d)::text from public.dt_claim_notification_batch(array['whatsapp'],20) d
  where d.payload->>'actionPath'='/requests/'||current_setting('dt.request5') limit 1),true);
select public.dt_prepare_notification((current_setting('dt.wa5')::jsonb->>'delivery_id')::bigint,
  (current_setting('dt.wa5')::jsonb->>'claim_token')::uuid,'{"To":"whatsapp:+27656193002"}');
select public.dt_finish_notification_delivery((current_setting('dt.wa5')::jsonb->>'delivery_id')::bigint,
  (current_setting('dt.wa5')::jsonb->>'claim_token')::uuid,current_setting('dt.wa5')::jsonb->>'idempotency_key',
  'retry_scheduled',null,'provider_429',now()-interval '1 second');
update dt_private.notification_deliveries set next_attempt_at=now()-interval '1 second'
  where id=(current_setting('dt.wa5')::jsonb->>'delivery_id')::bigint;
select count(*) from public.dt_claim_notification_batch(array['whatsapp'],20);
update dt_private.notification_deliveries set claimed_at=now()-interval '6 minutes'
  where id=(current_setting('dt.wa5')::jsonb->>'delivery_id')::bigint;
-- Second worker died before prepare/HTTP; lifetime marker must not imply this lease sent.
select count(*) from public.dt_claim_notification_batch(array['whatsapp'],20);
insert into dt_test_results select is((select status from dt_private.notification_deliveries
  where id=(current_setting('dt.wa5')::jsonb->>'delivery_id')::bigint),'processing',
  'a crash before prepare after a rejected WhatsApp attempt is safely reclaimable');

-- A live pilot cannot leak to an account outside its recipient allowlist.
update dt_private.notification_channels set recipient_allowlist=array[pg_temp.uid(1)]
  where channel='email';
select pg_temp.login(2);
set local role authenticated;
select set_config('dt.request6',public.dt_submit_request(pg_temp.payload(16))::text,true);
reset role;
select set_config('dt.creator6',(select to_jsonb(d)::text
  from public.dt_claim_notification_batch(array['email'],20) d
  where d.payload->>'actionPath'='/dashboard/requests/'||current_setting('dt.request6') limit 1),true);
insert into dt_test_results select is((select status from dt_private.notification_deliveries
  where request_id=current_setting('dt.request6')::uuid and recipient_role='creator' and channel='email'),
  'processing','pilot claims the authorized creator recipient');
insert into dt_test_results select is((select status from dt_private.notification_deliveries
  where request_id=current_setting('dt.request6')::uuid and recipient_role='requester' and channel='email'),
  'queued','pilot leaves an unlisted requester receipt unsent');
-- Revoking pilot eligibility after claim must also stop the prepared provider send.
update dt_private.notification_channels set recipient_allowlist=array[pg_temp.uid(2)]
  where channel='email';
insert into dt_test_results select is(public.dt_prepare_notification(
  (current_setting('dt.creator6')::jsonb->>'delivery_id')::bigint,
  (current_setting('dt.creator6')::jsonb->>'claim_token')::uuid,'{"subject":"outside pilot"}'),
  null::jsonb,'prepare rechecks pilot eligibility after the allowlist changes');
insert into dt_test_results select ok((select status='suppressed'
  and provider_payload is null and send_started_at is null
  from dt_private.notification_deliveries
  where id=(current_setting('dt.creator6')::jsonb->>'delivery_id')::bigint),
  'removed pilot recipient is suppressed before freezing or sending a payload');
select count(*) from public.dt_claim_notification_batch(array['email'],20);
insert into dt_test_results select is((select status from dt_private.notification_deliveries
  where request_id=current_setting('dt.request6')::uuid and recipient_role='requester' and channel='email'),
  'processing','newly allowlisted requester can receive the queued pilot receipt');
update dt_private.notification_channels set recipient_allowlist=null where channel='email';

-- Simulate historical requests, not new price-less submissions. Their original
-- fixed/quoted terms remain private and unchanged under the external policy.
update public.dt_services set definition=definition||'{"kind":"deliverable"}'::jsonb
  where id=pg_temp.uid(10);
select set_config('dt.legacy_fixed_snapshot',(select (definition||
  '{"pricing":"fixed","amount":2500,"currency":"ZAR"}'::jsonb)::text
  from public.dt_services where id=pg_temp.uid(10)),true);
select set_config('dt.legacy_quote_snapshot',(select (definition||
  '{"pricing":"quote","amount":0,"currency":"ZAR"}'::jsonb)::text
  from public.dt_services where id=pg_temp.uid(10)),true);
select pg_temp.login(2);
insert into public.dt_requests(id,creator_id,service_id,requester_id,idempotency_key,
  snapshot,requester_name,requester_email,visitor_timezone)
values(pg_temp.uid(20),pg_temp.uid(1),pg_temp.uid(10),pg_temp.uid(2),pg_temp.uid(20),
  current_setting('dt.legacy_fixed_snapshot')::jsonb,'Legacy fixed fan',
  'dt-notification-test-2@example.test','UTC'),
  (pg_temp.uid(21),pg_temp.uid(1),pg_temp.uid(10),pg_temp.uid(2),pg_temp.uid(21),
  current_setting('dt.legacy_quote_snapshot')::jsonb,'Legacy quote fan',
  'dt-notification-test-2@example.test','UTC');
select pg_temp.login(1);
set local role authenticated;
insert into dt_test_results select lives_ok($$select public.dt_transition_request(pg_temp.uid(20),'accept',1)$$,
  'legacy fixed-price delivery is accept-able without payment processing');
insert into dt_test_results select lives_ok($$select public.dt_transition_request(pg_temp.uid(21),'accept',1)$$,
  'legacy quoted non-enquiry delivery is accept-able under the external arrangement policy');
reset role;
insert into dt_test_results select is((select snapshot::text from public.dt_requests where id=pg_temp.uid(20)),
  current_setting('dt.legacy_fixed_snapshot'),'acceptance preserves the exact stored legacy fixed snapshot bytes');
insert into dt_test_results select is((select snapshot::text from public.dt_requests where id=pg_temp.uid(21)),
  current_setting('dt.legacy_quote_snapshot'),'acceptance preserves the exact stored legacy quote snapshot bytes');
insert into dt_test_results select is((select count(*)::int from public.dt_requests
  where id in(pg_temp.uid(20),pg_temp.uid(21)) and status='CONFIRMED' and arrangement_policy='external-v1'),2,
  'both legacy requests confirm service only, never a paid or awaiting-payment state');
insert into dt_test_results select * from finish();
select result from dt_test_results;
rollback;
