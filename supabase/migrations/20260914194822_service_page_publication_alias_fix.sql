-- Preserve applied migration history; fix PL/pgSQL alias ambiguity.
create or replace function dt_private.publish_page(publish boolean, expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := dt_private.actor(); d jsonb; s jsonb; rev integer;
begin
  perform 1 from public.profiles_private where id=uid for update;
  select document,revision into d,rev from public.dt_page_drafts where creator_id=uid;
  if d is null or publish is null or expected_revision is null or rev<>expected_revision then raise exception 'Save or reload your page before publishing.'; end if;
  if not publish then update public.profiles_public set is_published=false,published_at=null where creator_id=uid; return; end if;
  if not exists(select 1 from public.profiles_private where id=uid and is_adult and terms_accepted_at is not null and privacy_accepted_at is not null) then raise exception 'Complete age, terms and privacy consent before publishing.'; end if;
  if not exists(select 1 from jsonb_array_elements(d->'services') entry where entry->>'active'='true') then raise exception 'Add an active service first.'; end if;
  if exists(select 1 from jsonb_array_elements(d->'services') entry where entry->>'active'='true' and entry->>'kind'='scheduled') and jsonb_array_length(d#>'{availability,windows}')=0 and not exists(select 1 from jsonb_array_elements(d#>'{availability,exceptions}') e where jsonb_array_length(e->'windows')>0) then raise exception 'Set appointment availability first.'; end if;
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


create index dt_requests_service_creator_idx on public.dt_requests(service_id,creator_id);
