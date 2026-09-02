alter table rush.applications
  add column if not exists process_survey_submitted_at timestamptz;
alter table rush.applications drop constraint if exists applications_resume_storage_path_check;
alter table rush.applications add constraint applications_resume_storage_path_check check (
  resume_storage_path is null
  or resume_storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]+/(resume|[0-9a-f-]{36})\.pdf$'
);
drop policy if exists applications_read_internal on rush.applications;
create policy applications_read_internal on rush.applications for select to authenticated
using (
  not exists (
    select 1 from rush.conflict_declarations c
    where c.application_id = applications.id and c.declarer_id = auth.uid()
  )
  and (
    rush.has_cycle_role(cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[])
    or (rush.has_cycle_capability(cycle_id, 'CANDIDATE_ACCESS') and not rush.is_active_screening_reviewer(cycle_id))
    or (
      exists (
        select 1 from rush.evaluation_assignments ea
        where ea.application_id = applications.id and ea.evaluator_id = auth.uid()
      )
      and not rush.is_active_screening_reviewer(cycle_id)
    )
  )
);
drop policy if exists applications_read_self on rush.applications;
create policy applications_read_self on rush.applications for select to authenticated
using (rush.owns_application(id));
drop policy if exists pnms_read_internal on rush.pnms;
create policy pnms_read_internal on rush.pnms for select to authenticated
using (exists (
  select 1 from rush.applications a
  where a.pnm_id = pnms.id
    and not exists (
      select 1 from rush.conflict_declarations c
      where c.application_id = a.id and c.declarer_id = auth.uid()
    )
    and (
      rush.has_cycle_role(a.cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[])
      or (rush.has_cycle_capability(a.cycle_id, 'CANDIDATE_ACCESS') and not rush.is_active_screening_reviewer(a.cycle_id))
      or (
        exists (
          select 1 from rush.evaluation_assignments ea
          where ea.application_id = a.id and ea.evaluator_id = auth.uid()
        )
        and not rush.is_active_screening_reviewer(a.cycle_id)
      )
    )
));
drop policy if exists pnms_read_self on rush.pnms;
create policy pnms_read_self on rush.pnms for select to authenticated
using (auth_user_id = auth.uid());
-- security definer so this bypasses RLS on rush.applications/rush.pnms when called from a
-- storage.objects policy below — an inline subquery there would instead re-trigger those
-- tables' own RLS policies mid-evaluation and fail with "infinite recursion detected in
-- policy for relation applications" (confirmed against a real Postgres instance).
create or replace function rush.resume_upload_locked(target_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from rush.applications a
    join rush.pnms p on p.id = a.pnm_id
    where p.auth_user_id = auth.uid()
      and a.resume_storage_path = target_path
      and a.status not in ('DRAFT','NEEDS_INFO')
  );
$$;
revoke all on function rush.resume_upload_locked(text) from public,anon;
grant execute on function rush.resume_upload_locked(text) to authenticated;
drop policy if exists storage_resumes_applicant_insert on storage.objects;
drop policy if exists storage_resumes_applicant_update on storage.objects;
create policy storage_resumes_applicant_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'resumes'
  and name = rush.create_resume_upload()
  and metadata->>'mimetype' = 'application/pdf'
  and case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint between 1 and 10485760 else false end
  and not rush.resume_upload_locked(name)
);
create policy storage_resumes_applicant_update on storage.objects for update to authenticated
using (
  bucket_id = 'resumes'
  and name = rush.create_resume_upload()
  and not rush.resume_upload_locked(name)
)
with check (
  bucket_id = 'resumes'
  and name = rush.create_resume_upload()
  and metadata->>'mimetype' = 'application/pdf'
  and case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint between 1 and 10485760 else false end
  and not rush.resume_upload_locked(name)
);
create or replace function rush.create_resume_upload()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); v_cycle_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select c.id into v_cycle_id from rush.rush_cycles c
  where c.status = 'OPEN' and (c.opens_at is null or c.opens_at <= now()) and (c.closes_at is null or c.closes_at >= now())
  order by c.created_at desc limit 1;
  if v_cycle_id is null then raise exception 'applications are not open' using errcode = '55000'; end if;
  return actor::text || '/' || v_cycle_id || '/resume.pdf';
end;
$$;
drop function if exists rush.submit_application(text,text,text,text,text,text,text,text,jsonb,boolean);
drop function if exists rush.submit_application(text,text,text,text,text,text,text,text,jsonb,boolean,text,text,text,text);
create function rush.submit_application(
  applicant_name text,
  applicant_contact text,
  preferred_name text default null,
  phone text default null,
  class_year text default null,
  major text default null,
  linkedin_url text default null,
  resume_storage_path text default null,
  answers jsonb default '{}'::jsonb,
  consent boolean default true,
  uniqname text default null,
  college text default null,
  grad_term text default null,
  accessibility_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor uuid := auth.uid();
  normalized text := lower(trim(applicant_contact));
  v_cycle_id text;
  open_cycle_id text;
  person_id text;
  application_id text;
  existing_status rush.application_status;
  existing_resume_path text;
  question_row rush.application_questions%rowtype;
  answer_text text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('submit:'||actor::text,0));
  if consent is not true then raise exception 'consent is required' using errcode = '22023'; end if;
  if char_length(trim(applicant_name)) not between 1 and 120 or char_length(normalized) not between 3 and 254 then
    raise exception 'invalid applicant details' using errcode = '22023';
  end if;
  if preferred_name is not null and char_length(trim(preferred_name)) not between 1 and 80 then raise exception 'invalid preferred name' using errcode='22023'; end if;
  if phone is not null and char_length(trim(phone)) not between 7 and 32 then raise exception 'invalid phone' using errcode='22023'; end if;
  if class_year is null or class_year not in ('FIRST_YEAR','SOPHOMORE','JUNIOR','SENIOR','GRADUATE') then raise exception 'invalid class year' using errcode='22023'; end if;
  if major is null or char_length(trim(major)) not between 1 and 120 then raise exception 'invalid major' using errcode='22023'; end if;
  if uniqname is null or lower(trim(uniqname)) !~ '^[a-z][a-z0-9]{1,15}$' then raise exception 'invalid uniqname' using errcode='22023'; end if;
  if college is null or college not in ('Engineering','LSA','Ross','Information','Stamps','Kinesiology','Nursing','Public Policy','Other') then raise exception 'invalid college' using errcode='22023'; end if;
  if grad_term is not null and char_length(trim(grad_term)) not between 1 and 40 then raise exception 'invalid graduation term' using errcode='22023'; end if;
  if accessibility_notes is not null and char_length(accessibility_notes) > 2000 then raise exception 'invalid accessibility notes' using errcode='22023'; end if;
  if linkedin_url is not null and (char_length(trim(linkedin_url)) not between 8 and 400 or trim(linkedin_url) !~* '^https?://[^[:space:]]+$') then raise exception 'invalid linkedin url' using errcode='22023'; end if;
  if jsonb_typeof(answers) <> 'object' or (select count(*) from jsonb_object_keys(answers)) > 50 then raise exception 'invalid answers' using errcode='22023'; end if;
  if exists (select 1 from jsonb_each(answers) x where char_length(x.key) > 80 or x.key !~ '^[a-z][a-z0-9_]*$' or jsonb_typeof(x.value) <> 'string') then raise exception 'invalid answers' using errcode='22023'; end if;
  if exists (select 1 from jsonb_each_text(answers) x where char_length(x.value) > 8000)
    or (select coalesce(sum(char_length(x.value)), 0) from jsonb_each_text(answers) x) > 40000 then
    raise exception 'answers too long' using errcode='22023';
  end if;
  if resume_storage_path is null or resume_storage_path !~ ('^' || actor::text || '/[A-Za-z0-9_-]+/(resume|[0-9a-f-]{36})\.pdf$') then raise exception 'invalid resume path' using errcode='22023'; end if;
  v_cycle_id := split_part(resume_storage_path,'/',2);

  select p.id into person_id from rush.pnms p where p.auth_user_id=actor for update;
  if person_id is not null then
    select a.id,a.status,a.resume_storage_path into application_id,existing_status,existing_resume_path from rush.applications a
    where a.pnm_id=person_id and a.cycle_id=v_cycle_id for update;
    if application_id is not null and existing_status not in ('DRAFT','NEEDS_INFO') then
      if resume_storage_path = actor::text || '/' || v_cycle_id || '/resume.pdf'
        or resume_storage_path = existing_resume_path then
        return jsonb_build_object('applicationId',application_id,'submittedNow',false);
      end if;
      raise exception 'invalid resume path' using errcode='22023';
    end if;
  end if;

  select c.id into open_cycle_id from rush.rush_cycles c
  where c.status = 'OPEN' and (c.opens_at is null or c.opens_at <= now()) and (c.closes_at is null or c.closes_at >= now())
  order by c.created_at desc limit 1;
  if open_cycle_id is null then raise exception 'applications are not open' using errcode = '55000'; end if;
  if v_cycle_id <> open_cycle_id or (
    resume_storage_path <> (actor::text || '/' || open_cycle_id || '/resume.pdf')
    and not (
      application_id is not null and existing_status in ('DRAFT','NEEDS_INFO')
      and resume_storage_path = existing_resume_path
      and resume_storage_path ~ ('^' || actor::text || '/' || open_cycle_id || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$')
    )
  ) then raise exception 'invalid resume path' using errcode='22023'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id='resumes' and o.name=resume_storage_path) then raise exception 'resume upload is required' using errcode='22023'; end if;
  if exists (select 1 from jsonb_object_keys(answers) as answer_key(key) where not exists (select 1 from rush.application_questions q where q.cycle_id=v_cycle_id and q.key=answer_key.key)) then raise exception 'unknown application answer' using errcode='22023'; end if;

  for question_row in select * from rush.application_questions q where q.cycle_id=v_cycle_id order by q.sort_order loop
    answer_text := nullif(trim(answers ->> question_row.key), '');
    if question_row.required and answer_text is null then raise exception 'missing answer for %', question_row.key using errcode='22023'; end if;
    if answer_text is not null and char_length(answer_text) > 8000 then raise exception 'answer too long' using errcode='22023'; end if;
    if question_row.input_type='select' and answer_text is not null and (
      jsonb_typeof(question_row.options)<>'array' or not exists (
        select 1 from jsonb_array_elements(question_row.options) configured(value)
        where jsonb_typeof(configured.value)='string' and configured.value #>> '{}' = answer_text
      )
    ) then raise exception 'invalid selection for %',question_row.key using errcode='22023'; end if;
    if question_row.input_type='url' and answer_text is not null and answer_text !~* '^https?://[^/?#[:space:]]+([/?#][^[:space:]]*)?$' then
      raise exception 'invalid url for %',question_row.key using errcode='22023';
    end if;
  end loop;

  if person_id is null then
    if exists (select 1 from rush.pnms p where p.normalized_contact=normalized and p.auth_user_id is distinct from actor) then raise exception 'contact belongs to another account' using errcode='23505'; end if;
    insert into rush.pnms (auth_user_id,name,contact,normalized_contact,preferred_name,phone,class_year,major,linkedin_url,uniqname,college,grad_term,accessibility_notes)
    values (actor,trim(applicant_name),trim(applicant_contact),normalized,nullif(trim(preferred_name),''),nullif(trim(phone),''),class_year,trim(major),nullif(trim(linkedin_url),''),lower(trim(uniqname)),college,nullif(trim(grad_term),''),nullif(trim(accessibility_notes),''))
    returning id into person_id;
  else
    update rush.pnms p set
      name=trim(applicant_name), contact=trim(applicant_contact), normalized_contact=normalized,
      preferred_name=coalesce(nullif(trim(submit_application.preferred_name),''),p.preferred_name),
      phone=coalesce(nullif(trim(submit_application.phone),''),p.phone), class_year=coalesce(submit_application.class_year,p.class_year),
      major=trim(submit_application.major), linkedin_url=coalesce(nullif(trim(submit_application.linkedin_url),''),p.linkedin_url),
      uniqname=lower(trim(submit_application.uniqname)), college=coalesce(submit_application.college,p.college),
      grad_term=coalesce(nullif(trim(submit_application.grad_term),''),p.grad_term),
      accessibility_notes=coalesce(nullif(trim(submit_application.accessibility_notes),''),p.accessibility_notes)
    where p.id=person_id;
  end if;
  if application_id is null then
    insert into rush.applications (pnm_id,cycle_id,status,submitted_at,resume_storage_path,draft_payload)
    values (person_id,v_cycle_id,'SUBMITTED',now(),resume_storage_path,null) returning id into application_id;
  else
    update rush.applications a set status='SUBMITTED',submitted_at=now(),resume_storage_path=submit_application.resume_storage_path,draft_payload=null
    where a.id=application_id;
  end if;
  delete from rush.application_responses r where r.application_id=application_id;
  insert into rush.application_responses (application_id,question_key,question_text,response_text)
  select application_id,q.key,q.prompt,trim(answers ->> q.key) from rush.application_questions q
  where q.cycle_id=v_cycle_id and nullif(trim(answers ->> q.key),'') is not null;
  insert into rush.audit_events (actor_id,cycle_id,action,resource,resource_id)
  values (actor,v_cycle_id,'APPLICATION_SUBMITTED','Application',application_id);
  return jsonb_build_object('applicationId',application_id,'submittedNow',true);
end;
$$;
create or replace function rush.submit_application_self_test(applicant_name text,applicant_contact text)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); cycle_id text; resume_path text; result jsonb;
begin
  if actor is null or applicant_contact<>(('workflow-'||actor::text||'@example.invalid')) then raise exception 'workflow self-test only' using errcode='42501'; end if;
  select c.id into cycle_id from rush.rush_cycles c
  where c.status='OPEN' and (c.opens_at is null or c.opens_at<=now()) and (c.closes_at is null or c.closes_at>=now())
  order by c.created_at desc limit 1;
  if cycle_id is null then raise exception 'applications are not open' using errcode='55000'; end if;
  resume_path:=actor::text||'/'||cycle_id||'/resume.pdf';
  insert into storage.objects (bucket_id,name,owner_id,metadata)
  values ('resumes',resume_path,actor::text,jsonb_build_object('mimetype','application/pdf','size',1))
  on conflict (bucket_id,name) do update set owner_id=excluded.owner_id,metadata=excluded.metadata;
  result:=rush.submit_application(applicant_name,applicant_contact,null,null,'JUNIOR','Self Test',null,resume_path,'{}'::jsonb,true,'w'||substr(replace(actor::text,'-',''),1,15),'Other',null,null);
  return result->>'applicationId';
end; $$;
create or replace function rush.save_application_draft(payload jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); v_cycle_id text; person_id text; application_id text; draft_answers jsonb := coalesce(payload->'answers','{}'::jsonb);
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 65536 or jsonb_typeof(draft_answers) <> 'object' or (select count(*) from jsonb_object_keys(draft_answers)) > 50 then raise exception 'invalid draft' using errcode='22023'; end if;
  if exists (select 1 from jsonb_each(draft_answers) x where char_length(x.key)>80 or x.key !~ '^[a-z][a-z0-9_]*$' or jsonb_typeof(x.value)<>'string') then raise exception 'invalid draft answers' using errcode='22023'; end if;
  if exists (select 1 from jsonb_each_text(draft_answers) x where char_length(x.value)>8000)
    or (select coalesce(sum(char_length(x.value)),0) from jsonb_each_text(draft_answers) x)>40000 then raise exception 'draft answers too long' using errcode='22023'; end if;
  select c.id into v_cycle_id from rush.rush_cycles c
  where c.status='OPEN' and (c.opens_at is null or c.opens_at<=now()) and (c.closes_at is null or c.closes_at>=now())
  order by c.created_at desc limit 1;
  if v_cycle_id is null then raise exception 'applications are not open' using errcode='55000'; end if;
  select p.id into person_id from rush.pnms p where p.auth_user_id=actor;
  if person_id is null then
    insert into rush.pnms (auth_user_id,name,contact,normalized_contact)
    values (actor,coalesce(nullif(trim(payload->>'name'),''),'Applicant'),coalesce(auth.jwt()->>'email','pending@invalid'),lower(coalesce(auth.jwt()->>'email','pending@invalid')))
    returning id into person_id;
  end if;
  insert into rush.applications (pnm_id,cycle_id,status,draft_payload) values (person_id,v_cycle_id,'DRAFT',payload)
  on conflict (pnm_id,cycle_id) do update set draft_payload=excluded.draft_payload
  where rush.applications.status in ('DRAFT','NEEDS_INFO') returning id into application_id;
  if application_id is null then raise exception 'application can no longer be edited' using errcode='55000'; end if;
  return application_id;
end; $$;
drop function if exists rush.respond_to_offer(boolean);
drop function if exists rush.respond_to_offer(text,boolean);
create function rush.respond_to_offer(target_application_id text,accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); app_row rush.applications%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if accept is null then raise exception 'response required' using errcode='22023'; end if;
  select a.* into app_row from rush.applications a where a.id=target_application_id for update;
  if app_row.id is null then raise exception 'no offer' using errcode='P0002'; end if;
  if not exists (select 1 from rush.pnms p where p.id=app_row.pnm_id and p.auth_user_id=actor) then raise exception 'forbidden' using errcode='42501'; end if;
  if app_row.status<>'OFFERED' or not exists (select 1 from rush.decisions d where d.application_id=app_row.id and d.outcome='OFFER' and d.status='RELEASED') then raise exception 'no released offer' using errcode='42501'; end if;
  if app_row.offer_response is not null then raise exception 'offer already answered' using errcode='55000'; end if;
  update rush.applications a set offer_response=case when accept then 'ACCEPTED' else 'DECLINED' end,offer_responded_at=now() where a.id=app_row.id;
  insert into rush.audit_events (actor_id,cycle_id,action,resource,resource_id,metadata)
  values (actor,app_row.cycle_id,'OFFER_RESPONSE','Application',app_row.id,jsonb_build_object('response',case when accept then 'ACCEPTED' else 'DECLINED' end));
end; $$;
create or replace function rush.rsvp_slot(target_slot_id text)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); slot rush.event_slots%rowtype; event_row rush.events%rowtype; app_row rush.applications%rowtype; taken integer; result_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select s.* into slot from rush.event_slots s where s.id=target_slot_id for update;
  if slot.id is null then raise exception 'slot missing' using errcode='P0002'; end if;
  select e.* into event_row from rush.events e where e.id=slot.event_id;
  select a.* into app_row from rush.applications a join rush.pnms p on p.id=a.pnm_id where p.auth_user_id=actor and a.cycle_id=event_row.cycle_id;
  if app_row.id is null or app_row.status in ('DRAFT','NEEDS_INFO','REJECTED','WITHDRAWN') then raise exception 'eligible application required' using errcode='42501'; end if;
  if event_row.status<>'PUBLISHED' or event_row.visibility='INTERNAL' or slot.starts_at<=now()
    or not exists (select 1 from rush.rush_cycles c where c.id=event_row.cycle_id and c.status in ('OPEN','IN_PROCESS','DECISION_LOCK'))
    or (event_row.visibility='INVITE' and app_row.status not in ('INVITED','IN_PROCESS','FINAL_REVIEW','OFFERED','WAITLISTED')) then raise exception 'slot unavailable' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rsvp:'||app_row.id||':'||event_row.id,0));
  select r.id into result_id from rush.slot_rsvps r where r.slot_id=slot.id and r.application_id=app_row.id;
  if result_id is not null then return result_id; end if;
  if exists (select 1 from rush.slot_rsvps r join rush.event_slots booked on booked.id=r.slot_id where r.application_id=app_row.id and booked.event_id=event_row.id) then raise exception 'event already booked' using errcode='55000'; end if;
  select count(*) into taken from rush.slot_rsvps r where r.slot_id=slot.id;
  if taken>=slot.capacity then raise exception 'slot full' using errcode='55000'; end if;
  insert into rush.slot_rsvps (slot_id,application_id) values (slot.id,app_row.id) returning id into result_id;
  return result_id;
end; $$;
create or replace function rush.book_buddy_slot(target_slot_id text)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); slot rush.buddy_slots%rowtype; app_row rush.applications%rowtype; result_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select s.* into slot from rush.buddy_slots s where s.id=target_slot_id for update;
  if slot.id is null then raise exception 'slot missing' using errcode='P0002'; end if;
  select a.* into app_row from rush.applications a join rush.pnms p on p.id=a.pnm_id where p.auth_user_id=actor and a.cycle_id=slot.cycle_id;
  if app_row.id is null or app_row.status in ('DRAFT','NEEDS_INFO','REJECTED','WITHDRAWN') then raise exception 'eligible application required' using errcode='42501'; end if;
  if slot.starts_at<=now() or not exists (select 1 from rush.rush_cycles c where c.id=slot.cycle_id and c.status in ('OPEN','IN_PROCESS','DECISION_LOCK')) then raise exception 'slot unavailable' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('buddy:'||app_row.id||':'||slot.cycle_id,0));
  select b.id into result_id from rush.buddy_bookings b where b.slot_id=slot.id and b.application_id=app_row.id;
  if result_id is not null then return result_id; end if;
  if exists (select 1 from rush.buddy_bookings b join rush.buddy_slots booked on booked.id=b.slot_id where b.application_id=app_row.id and booked.cycle_id=slot.cycle_id) then raise exception 'buddy meeting already booked' using errcode='55000'; end if;
  if exists (select 1 from rush.buddy_bookings b where b.slot_id=slot.id) then raise exception 'slot taken' using errcode='55000'; end if;
  insert into rush.buddy_bookings (slot_id,application_id) values (slot.id,app_row.id) returning id into result_id;
  return result_id;
end; $$;
create or replace function rush.applicant_schedule()
returns jsonb language sql stable security definer set search_path='' as $$
  with my_apps as (
    select distinct on (a.cycle_id) a.id,a.cycle_id,a.status
    from rush.applications a join rush.pnms p on p.id=a.pnm_id
    where p.auth_user_id=auth.uid() order by a.cycle_id,a.created_at desc
  )
  select jsonb_build_object(
    'rsvps',coalesce((select jsonb_agg(jsonb_build_object('slotId',s.id,'eventName',e.name,'startsAt',s.starts_at,'endsAt',s.ends_at,'location',e.location) order by s.starts_at)
      from my_apps ma join rush.slot_rsvps r on r.application_id=ma.id join rush.event_slots s on s.id=r.slot_id join rush.events e on e.id=s.event_id),'[]'::jsonb),
    'group',(select jsonb_build_object('name',g.name,'prompt',g.prompt) from my_apps ma join rush.case_group_members m on m.application_id=ma.id join rush.case_groups g on g.id=m.group_id order by g.created_at desc limit 1),
    'buddy',(select jsonb_build_object('startsAt',s.starts_at,'endsAt',s.ends_at) from my_apps ma join rush.buddy_bookings b on b.application_id=ma.id join rush.buddy_slots s on s.id=b.slot_id order by s.starts_at desc limit 1),
    'openSlots',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'eventName',e.name,'startsAt',s.starts_at,'endsAt',s.ends_at,'remaining',s.capacity-(select count(*) from rush.slot_rsvps x where x.slot_id=s.id)) order by s.starts_at)
      from my_apps ma join rush.rush_cycles c on c.id=ma.cycle_id join rush.events e on e.cycle_id=ma.cycle_id join rush.event_slots s on s.event_id=e.id
      where ma.status not in ('DRAFT','NEEDS_INFO','REJECTED','WITHDRAWN') and c.status in ('OPEN','IN_PROCESS','DECISION_LOCK') and e.status='PUBLISHED' and e.visibility in ('PUBLIC','INVITE') and s.starts_at>now()
        and (e.visibility='PUBLIC' or ma.status in ('INVITED','IN_PROCESS','FINAL_REVIEW','OFFERED','WAITLISTED'))
        and not exists (select 1 from rush.slot_rsvps own join rush.event_slots booked on booked.id=own.slot_id where own.application_id=ma.id and booked.event_id=e.id)
        and (select count(*) from rush.slot_rsvps x where x.slot_id=s.id)<s.capacity),'[]'::jsonb),
    'openBuddy',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'startsAt',s.starts_at,'endsAt',s.ends_at) order by s.starts_at)
      from my_apps ma join rush.rush_cycles c on c.id=ma.cycle_id join rush.buddy_slots s on s.cycle_id=ma.cycle_id
      where ma.status not in ('DRAFT','NEEDS_INFO','REJECTED','WITHDRAWN') and c.status in ('OPEN','IN_PROCESS','DECISION_LOCK') and s.starts_at>now()
        and not exists (select 1 from rush.buddy_bookings b where b.slot_id=s.id)
        and not exists (select 1 from rush.buddy_bookings own join rush.buddy_slots booked on booked.id=own.slot_id where own.application_id=ma.id and booked.cycle_id=ma.cycle_id)),'[]'::jsonb)
  );
$$;
drop function if exists rush.submit_process_survey(integer,text);
drop function if exists rush.submit_process_survey(text,integer,text);
create function rush.submit_process_survey(target_application_id text,score integer,survey_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); app_row rush.applications%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if score is null or score not between 1 and 5 or (survey_note is not null and char_length(survey_note)>2000) then raise exception 'invalid survey' using errcode='22023'; end if;
  select a.* into app_row from rush.applications a where a.id=target_application_id for update;
  if app_row.id is null then raise exception 'application required' using errcode='P0002'; end if;
  if not exists (select 1 from rush.pnms p where p.id=app_row.pnm_id and p.auth_user_id=actor) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists (select 1 from rush.decisions d where d.application_id=app_row.id and d.status='RELEASED') then raise exception 'released decision required' using errcode='42501'; end if;
  if app_row.process_survey_submitted_at is not null then raise exception 'survey already submitted' using errcode='55000'; end if;
  insert into rush.process_surveys (cycle_id,rating,note) values (app_row.cycle_id,score,nullif(trim(survey_note),''));
  update rush.applications a set process_survey_submitted_at=now() where a.id=app_row.id;
end; $$;
drop function if exists rush.applicant_dashboard();
create function rush.applicant_dashboard()
returns table(application_id text,applicant_name text,cycle_name text,display_status text,released_outcome rush.decision_outcome,released_at timestamptz,has_resume boolean,responses jsonb,offer_response text,survey_submitted boolean)
language sql stable security definer set search_path='' as $$
  select a.id,p.name,c.name,
    case when d.id is not null then d.outcome::text when a.status in ('OFFERED','WAITLISTED','REJECTED') then 'FINAL_REVIEW' else a.status::text end,
    d.outcome,d.released_at,a.resume_storage_path is not null,
    coalesce((select jsonb_agg(jsonb_build_object('key',r.question_key,'prompt',r.question_text,'answer',r.response_text) order by r.created_at) from rush.application_responses r where r.application_id=a.id),'[]'::jsonb),
    case when d.id is not null and d.outcome='OFFER' then a.offer_response else null end,
    a.process_survey_submitted_at is not null
  from rush.pnms p join rush.applications a on a.pnm_id=p.id join rush.rush_cycles c on c.id=a.cycle_id
  left join lateral (select x.id,x.outcome,x.released_at from rush.decisions x where x.application_id=a.id and x.status='RELEASED' order by x.released_at desc limit 1) d on true
  where p.auth_user_id=auth.uid() order by a.created_at desc;
$$;
create or replace function rush.set_application_status(target_application_id text,next_status rush.application_status)
returns void language plpgsql security definer set search_path='' as $$
declare app_row rush.applications%rowtype;
begin
  select a.* into app_row from rush.applications a where a.id=target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode='P0002'; end if;
  if not rush.has_cycle_capability(app_row.cycle_id,'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode='42501'; end if;
  if exists (select 1 from rush.conflict_declarations c where c.application_id=app_row.id and c.declarer_id=auth.uid()) then raise exception 'conflict recusal' using errcode='42501'; end if;
  if next_status in ('OFFERED','WAITLISTED','REJECTED','WITHDRAWN') then raise exception 'decision and withdrawal outcomes cannot be set manually' using errcode='55000'; end if;
  if next_status<>app_row.status and not (
    (app_row.status='DRAFT' and next_status='SUBMITTED') or
    (app_row.status='SUBMITTED' and next_status in ('NEEDS_INFO','ELIGIBLE')) or
    (app_row.status='NEEDS_INFO' and next_status in ('SUBMITTED','ELIGIBLE')) or
    (app_row.status='ELIGIBLE' and next_status='INVITED') or
    (app_row.status='INVITED' and next_status='IN_PROCESS') or
    (app_row.status='IN_PROCESS' and next_status='FINAL_REVIEW')
  ) then raise exception 'invalid application transition' using errcode='55000'; end if;
  update rush.applications a set status=next_status where a.id=target_application_id;
  if next_status<>app_row.status then
    insert into rush.audit_events (actor_id,cycle_id,action,resource,resource_id,metadata)
    values (auth.uid(),app_row.cycle_id,'APPLICATION_STATUS_CHANGED','Application',target_application_id,jsonb_build_object('from',app_row.status,'to',next_status));
  end if;
end; $$;
revoke all on function rush.submit_application(text,text,text,text,text,text,text,text,jsonb,boolean,text,text,text,text),rush.save_application_draft(jsonb),rush.respond_to_offer(text,boolean),rush.rsvp_slot(text),rush.book_buddy_slot(text),rush.applicant_schedule(),rush.submit_process_survey(text,integer,text),rush.applicant_dashboard(),rush.set_application_status(text,rush.application_status) from public,anon;
grant execute on function rush.submit_application(text,text,text,text,text,text,text,text,jsonb,boolean,text,text,text,text),rush.save_application_draft(jsonb),rush.respond_to_offer(text,boolean),rush.rsvp_slot(text),rush.book_buddy_slot(text),rush.applicant_schedule(),rush.submit_process_survey(text,integer,text),rush.applicant_dashboard(),rush.set_application_status(text,rush.application_status) to authenticated,service_role;
revoke all on function rush.submit_application_self_test(text,text) from public,anon,authenticated;
create or replace function rush.create_decision(target_cycle_id text, target_application_id text, target_outcome rush.decision_outcome, decision_reason text)
returns text language plpgsql security definer set search_path='' as $$
declare result_id text;
begin
  if not rush.has_cycle_role(target_cycle_id,array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode='42501'; end if;
  if char_length(trim(decision_reason)) not between 1 and 4000 then raise exception 'reason required' using errcode='22023'; end if;
  if not exists(select 1 from rush.applications where id=target_application_id and cycle_id=target_cycle_id) then raise exception 'application missing' using errcode='P0002'; end if;
  if exists(select 1 from rush.applications where id=target_application_id and status='WITHDRAWN') then raise exception 'application withdrawn' using errcode='55000'; end if;
  if exists(select 1 from rush.conflict_declarations where application_id=target_application_id and declarer_id=auth.uid()) then raise exception 'conflict declared' using errcode='42501'; end if;
  if not exists(select 1 from rush.rush_cycles where id=target_cycle_id and status='DECISION_LOCK') then raise exception 'cycle not in decision lock' using errcode='55000'; end if;
  if exists(select 1 from rush.rounds r where r.cycle_id=target_cycle_id and r.status not in ('FROZEN','FINALIZED')) then raise exception 'rounds remain open' using errcode='55000'; end if;
  if exists(select 1 from rush.rounds r where r.cycle_id=target_cycle_id and (select count(*) from rush.evaluation_assignments a join rush.evaluations e on e.assignment_id=a.id where a.round_id=r.id and a.application_id=target_application_id and e.status='LOCKED') < 2) then raise exception 'insufficient evidence' using errcode='55000'; end if;
  insert into rush.decisions(cycle_id,application_id,outcome,reason,created_by_id) values(target_cycle_id,target_application_id,target_outcome,trim(decision_reason),auth.uid()) returning id into result_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle_id,'DECISION_CREATED','Decision',result_id);
  return result_id;
end; $$;
