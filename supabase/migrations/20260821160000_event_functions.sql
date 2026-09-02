create function rush.create_event(target_cycle_id text, event_name text, event_starts_at timestamptz, opens_at timestamptz, closes_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare raw_token text := gen_random_uuid()::text || gen_random_uuid()::text; event_id text;
begin
  if not rush.has_cycle_role(target_cycle_id,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from rush.rush_cycles where id=target_cycle_id and status not in ('CLOSED','ARCHIVED')) then raise exception 'cycle closed' using errcode='55000'; end if;
  if char_length(trim(event_name)) not between 1 and 160 or closes_at <= opens_at then raise exception 'invalid event' using errcode='22023'; end if;
  insert into rush.events(cycle_id,name,status,starts_at,checkin_opens_at,checkin_closes_at,checkin_token_digest)
  values(target_cycle_id,trim(event_name),'PUBLISHED',event_starts_at,opens_at,closes_at,encode(extensions.digest(raw_token,'sha256'),'hex')) returning id into event_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle_id,'EVENT_CREATED','Event',event_id);
  return jsonb_build_object('id',event_id,'checkinToken',raw_token);
end; $$;
create function rush.rotate_event_token(target_event_id text)
returns text language plpgsql security definer set search_path='' as $$
declare raw_token text := gen_random_uuid()::text || gen_random_uuid()::text; target_cycle text;
begin
  select cycle_id into target_cycle from rush.events where id=target_event_id for update;
  if target_cycle is null or not rush.has_cycle_role(target_cycle,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  update rush.events set checkin_token_digest=encode(extensions.digest(raw_token,'sha256'),'hex') where id=target_event_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle,'CHECKIN_TOKEN_ROTATED','Event',target_event_id);
  return raw_token;
end; $$;
revoke all on function rush.create_event(text,text,timestamptz,timestamptz,timestamptz),rush.rotate_event_token(text) from public,anon;
grant execute on function rush.create_event(text,text,timestamptz,timestamptz,timestamptz),rush.rotate_event_token(text) to authenticated,service_role;
