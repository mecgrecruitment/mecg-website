create function rush.grant_membership(target_user_id uuid, target_cycle_id text, target_role rush.member_role)
returns text language plpgsql security definer set search_path = '' as $$
declare result_id text;
begin
  if auth.uid() = target_user_id then raise exception 'self grant forbidden' using errcode = '42501'; end if;
  if not rush.has_cycle_role(target_cycle_id, array['OWNER']::rush.member_role[]) then raise exception 'owner required' using errcode = '42501'; end if;
  if not exists (select 1 from rush.profiles where id = target_user_id and active) then raise exception 'user missing' using errcode = 'P0002'; end if;
  insert into rush.memberships (user_id, cycle_id, role, active, revoked_at)
  values (target_user_id, target_cycle_id, target_role, true, null)
  on conflict (user_id, cycle_id, role) do update set active = true, revoked_at = null
  returning id into result_id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (auth.uid(), target_cycle_id, 'MEMBERSHIP_GRANTED', 'Profile', target_user_id::text, jsonb_build_object('role', target_role));
  return result_id;
end; $$;

create function rush.add_applicant(target_cycle_id text, applicant_name text, applicant_contact text)
returns text language plpgsql security definer set search_path = '' as $$
declare normalized text := lower(trim(applicant_contact)); person_id text; application_id text;
begin
  if not rush.has_cycle_role(target_cycle_id, array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from rush.rush_cycles where id = target_cycle_id and status in ('DRAFT','OPEN','IN_PROCESS')) then raise exception 'cycle closed' using errcode = '55000'; end if;
  if char_length(trim(applicant_name)) not between 1 and 120 or char_length(normalized) not between 3 and 254 then raise exception 'invalid applicant' using errcode = '22023'; end if;
  select id into person_id from rush.pnms where normalized_contact = normalized;
  if person_id is null then insert into rush.pnms (name,contact,normalized_contact) values (trim(applicant_name),trim(applicant_contact),normalized) returning id into person_id;
  else update rush.pnms set name = trim(applicant_name) where id = person_id; end if;
  insert into rush.applications (pnm_id,cycle_id,status,submitted_at) values (person_id,target_cycle_id,'IN_PROCESS',now())
  on conflict (pnm_id,cycle_id) do update set updated_at = rush.applications.updated_at returning id into application_id;
  insert into rush.audit_events (actor_id,cycle_id,action,resource,resource_id) values (auth.uid(),target_cycle_id,'APPLICATION_ADDED','Application',application_id);
  return application_id;
end; $$;

create function rush.assign_evaluator(target_cycle_id text, target_round_id text, target_application_id text, target_evaluator_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare result_id text; existing_status rush.assignment_status;
begin
  if not rush.has_cycle_role(target_cycle_id,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from rush.rush_cycles where id=target_cycle_id and status='IN_PROCESS') then raise exception 'cycle not in process' using errcode='55000'; end if;
  if not exists(select 1 from rush.rounds where id=target_round_id and cycle_id=target_cycle_id and status in ('DRAFT','PUBLISHED')) then raise exception 'round unavailable' using errcode='55000'; end if;
  if not exists(select 1 from rush.applications where id=target_application_id and cycle_id=target_cycle_id) then raise exception 'application missing' using errcode='P0002'; end if;
  if not exists(select 1 from rush.memberships where user_id=target_evaluator_id and cycle_id=target_cycle_id and active) then raise exception 'evaluator inactive' using errcode='42501'; end if;
  if exists(select 1 from rush.conflict_declarations where application_id=target_application_id and declarer_id=target_evaluator_id) then raise exception 'evaluator conflict' using errcode='42501'; end if;
  select status into existing_status from rush.evaluation_assignments where round_id=target_round_id and application_id=target_application_id and evaluator_id=target_evaluator_id for update;
  if existing_status is not null and existing_status <> 'ASSIGNED' then raise exception 'assignment locked' using errcode='55000'; end if;
  insert into rush.evaluation_assignments(round_id,application_id,evaluator_id) values(target_round_id,target_application_id,target_evaluator_id)
  on conflict(round_id,application_id,evaluator_id) do update set updated_at=now() returning id into result_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle_id,'EVALUATOR_ASSIGNED','EvaluationAssignment',result_id);
  return result_id;
end; $$;

create function rush.set_round_status(target_round_id text, next_status rush.round_status)
returns void language plpgsql security definer set search_path='' as $$
declare current_row rush.rounds%rowtype; cycle_status rush.cycle_status;
begin
  select * into current_row from rush.rounds where id=target_round_id for update;
  if current_row.id is null or not rush.has_cycle_role(current_row.cycle_id,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  select status into cycle_status from rush.rush_cycles where id=current_row.cycle_id;
  if current_row.status=next_status then return; end if;
  if not ((current_row.status='DRAFT' and next_status='PUBLISHED') or (current_row.status='PUBLISHED' and next_status='ACTIVE' and cycle_status='IN_PROCESS') or (current_row.status='ACTIVE' and next_status='FROZEN' and cycle_status in ('IN_PROCESS','DECISION_LOCK')) or (current_row.status='FROZEN' and next_status='FINALIZED') or (current_row.status='FINALIZED' and next_status='ARCHIVED')) then raise exception 'invalid round transition' using errcode='55000'; end if;
  update rush.rounds set status=next_status where id=target_round_id;
  if next_status='FROZEN' then update rush.evaluations e set status='LOCKED' from rush.evaluation_assignments a where e.assignment_id=a.id and a.round_id=target_round_id and e.status='SUBMITTED'; update rush.evaluation_assignments set status='LOCKED' where round_id=target_round_id and status='SUBMITTED'; end if;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(auth.uid(),current_row.cycle_id,'ROUND_STATUS_CHANGED','Round',target_round_id,jsonb_build_object('from',current_row.status,'to',next_status));
end; $$;

create function rush.set_cycle_status(target_cycle_id text, next_status rush.cycle_status)
returns void language plpgsql security definer set search_path='' as $$
declare current_status rush.cycle_status;
begin
  if not rush.has_cycle_role(target_cycle_id,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  select status into current_status from rush.rush_cycles where id=target_cycle_id for update;
  if current_status is null then raise exception 'cycle missing' using errcode='P0002'; end if;
  if current_status=next_status then return; end if;
  if not ((current_status='DRAFT' and next_status='OPEN') or (current_status='OPEN' and next_status='IN_PROCESS') or (current_status='IN_PROCESS' and next_status='DECISION_LOCK') or (current_status='DECISION_LOCK' and next_status='CLOSED') or (current_status='CLOSED' and next_status='ARCHIVED')) then raise exception 'invalid cycle transition' using errcode='55000'; end if;
  if next_status='DECISION_LOCK' and exists(select 1 from rush.rounds where cycle_id=target_cycle_id and status not in ('FROZEN','FINALIZED')) then raise exception 'rounds remain open' using errcode='55000'; end if;
  update rush.rush_cycles set status=next_status where id=target_cycle_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(auth.uid(),target_cycle_id,'CYCLE_STATUS_CHANGED','RushCycle',target_cycle_id,jsonb_build_object('from',current_status,'to',next_status));
end; $$;

revoke all on function rush.grant_membership(uuid,text,rush.member_role), rush.add_applicant(text,text,text), rush.assign_evaluator(text,text,text,uuid), rush.set_round_status(text,rush.round_status), rush.set_cycle_status(text,rush.cycle_status) from public,anon;
grant execute on function rush.grant_membership(uuid,text,rush.member_role), rush.add_applicant(text,text,text), rush.assign_evaluator(text,text,text,uuid), rush.set_round_status(text,rush.round_status), rush.set_cycle_status(text,rush.cycle_status) to authenticated,service_role;
