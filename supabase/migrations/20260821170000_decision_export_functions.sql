create function rush.create_decision(target_cycle_id text, target_application_id text, target_outcome rush.decision_outcome, decision_reason text)
returns text language plpgsql security definer set search_path='' as $$
declare result_id text;
begin
  if not rush.has_cycle_role(target_cycle_id,array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode='42501'; end if;
  if char_length(trim(decision_reason)) not between 1 and 4000 then raise exception 'reason required' using errcode='22023'; end if;
  if not exists(select 1 from rush.applications where id=target_application_id and cycle_id=target_cycle_id) then raise exception 'application missing' using errcode='P0002'; end if;
  if exists(select 1 from rush.conflict_declarations where application_id=target_application_id and declarer_id=auth.uid()) then raise exception 'conflict declared' using errcode='42501'; end if;
  if not exists(select 1 from rush.rush_cycles where id=target_cycle_id and status='DECISION_LOCK') then raise exception 'cycle not in decision lock' using errcode='55000'; end if;
  if exists(select 1 from rush.rounds r where r.cycle_id=target_cycle_id and r.status not in ('FROZEN','FINALIZED')) then raise exception 'rounds remain open' using errcode='55000'; end if;
  if exists(select 1 from rush.rounds r where r.cycle_id=target_cycle_id and (select count(*) from rush.evaluation_assignments a join rush.evaluations e on e.assignment_id=a.id where a.round_id=r.id and a.application_id=target_application_id and e.status='LOCKED') < 2) then raise exception 'insufficient evidence' using errcode='55000'; end if;
  insert into rush.decisions(cycle_id,application_id,outcome,reason,created_by_id) values(target_cycle_id,target_application_id,target_outcome,trim(decision_reason),auth.uid()) returning id into result_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle_id,'DECISION_CREATED','Decision',result_id);
  return result_id;
end; $$;

create function rush.approve_decision(target_decision_id text)
returns table(locked boolean, approvals bigint) language plpgsql security definer set search_path='' as $$
declare d rush.decisions%rowtype;
begin
  select * into d from rush.decisions where id=target_decision_id for update;
  if d.id is null then raise exception 'decision missing' using errcode='P0002'; end if;
  if not rush.has_cycle_role(d.cycle_id,array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode='42501'; end if;
  if exists(select 1 from rush.conflict_declarations where application_id=d.application_id and declarer_id=auth.uid()) then raise exception 'conflict declared' using errcode='42501'; end if;
  if d.status not in ('PENDING','APPROVED') then raise exception 'decision closed' using errcode='55000'; end if;
  if not exists(select 1 from rush.rush_cycles where id=d.cycle_id and status='DECISION_LOCK') then raise exception 'cycle closed' using errcode='55000'; end if;
  insert into rush.decision_approvals(decision_id,approver_id) values(d.id,auth.uid()) on conflict do nothing;
  select count(*) into approvals from rush.decision_approvals da
  join rush.profiles p on p.id=da.approver_id and p.active
  where da.decision_id=d.id
    and exists(select 1 from rush.memberships m where m.user_id=da.approver_id and m.cycle_id=d.cycle_id and m.active and m.role in ('PANEL','OWNER'))
    and not exists(select 1 from rush.conflict_declarations c where c.application_id=d.application_id and c.declarer_id=da.approver_id);
  locked := approvals >= 2;
  update rush.decisions set status=case when locked then 'LOCKED'::rush.decision_status else 'APPROVED'::rush.decision_status end,locked_at=case when locked then now() else null end where id=d.id;
  if locked then update rush.applications set status=case d.outcome when 'OFFER' then 'OFFERED'::rush.application_status when 'WAITLIST' then 'WAITLISTED'::rush.application_status when 'REJECT' then 'REJECTED'::rush.application_status else 'FINAL_REVIEW'::rush.application_status end where id=d.application_id; end if;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(auth.uid(),d.cycle_id,case when locked then 'DECISION_LOCKED' else 'DECISION_APPROVED' end,'Decision',d.id,jsonb_build_object('validApprovals',approvals));
  return next;
end; $$;

create function rush.release_decision(target_decision_id text)
returns void language plpgsql security definer set search_path='' as $$
declare d rush.decisions%rowtype; valid_approvals bigint;
begin
  select * into d from rush.decisions where id=target_decision_id for update;
  if d.id is null then raise exception 'decision missing' using errcode='P0002'; end if;
  if not rush.has_cycle_role(d.cycle_id,array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode='42501'; end if;
  if exists(select 1 from rush.conflict_declarations where application_id=d.application_id and declarer_id=auth.uid()) then raise exception 'conflict declared' using errcode='42501'; end if;
  select count(*) into valid_approvals from rush.decision_approvals da join rush.profiles p on p.id=da.approver_id and p.active
  where da.decision_id=d.id and exists(select 1 from rush.memberships m where m.user_id=da.approver_id and m.cycle_id=d.cycle_id and m.active and m.role in ('PANEL','OWNER'))
  and not exists(select 1 from rush.conflict_declarations c where c.application_id=d.application_id and c.declarer_id=da.approver_id);
  if d.status<>'LOCKED' or valid_approvals<2 then raise exception 'decision not locked' using errcode='55000'; end if;
  update rush.decisions set status='RELEASED',released_at=now() where id=d.id and status='LOCKED';
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),d.cycle_id,'DECISION_RELEASED','Decision',d.id);
end; $$;

create function rush.export_attendance(target_cycle_id text)
returns table(applicant_code text,name text,status rush.application_status,events_attended bigint)
language plpgsql security definer set search_path='' as $$
begin
  if not rush.has_cycle_role(target_cycle_id,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle_id,'ATTENDANCE_EXPORTED','RushCycle',target_cycle_id);
  return query select a.id,p.name,a.status,count(c.id) from rush.applications a join rush.pnms p on p.id=a.pnm_id left join rush.checkins c on c.pnm_id=p.id left join rush.events e on e.id=c.event_id and e.cycle_id=target_cycle_id where a.cycle_id=target_cycle_id group by a.id,p.name,a.status order by p.name;
end; $$;

revoke all on function rush.create_decision(text,text,rush.decision_outcome,text),rush.approve_decision(text),rush.release_decision(text),rush.export_attendance(text) from public,anon;
grant execute on function rush.create_decision(text,text,rush.decision_outcome,text),rush.approve_decision(text),rush.release_decision(text),rush.export_attendance(text) to authenticated,service_role;
