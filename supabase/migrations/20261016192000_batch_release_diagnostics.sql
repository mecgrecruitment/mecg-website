-- Safe per-applicant diagnostics share the single release path's guards. No
-- applicant identity, provider error text or evidence enters the batch response.
create or replace function rush.decision_release_blocker(target_decision_id text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare d rush.decisions%rowtype; valid_approvals bigint;
begin
  select * into d from rush.decisions where id = target_decision_id;
  if d.id is null then return 'DECISION_MISSING'; end if;
  if not rush.has_cycle_role(d.cycle_id, array['PANEL','OWNER']::rush.member_role[]) then return 'RELEASE_FORBIDDEN'; end if;
  if exists (select 1 from rush.conflict_declarations where application_id=d.application_id and declarer_id=rush.actor_id()) then return 'ACTOR_CONFLICT'; end if;
  if d.status <> 'LOCKED' then return 'DECISION_NOT_LOCKED'; end if;
  if exists(select 1 from rush.applications where id=d.application_id and status='WITHDRAWN') then return 'APPLICATION_WITHDRAWN'; end if;
  if not rush.is_decision_ready(d.application_id) then return 'EVIDENCE_NOT_READY'; end if;
  select count(*) into valid_approvals from rush.decision_approvals da
  join rush.profiles p on p.id=da.approver_id and p.active
  where da.decision_id=d.id
    and exists(select 1 from rush.memberships m where m.user_id=da.approver_id and m.cycle_id=d.cycle_id and m.active and m.role in ('PANEL','OWNER'))
    and not exists(select 1 from rush.conflict_declarations c where c.application_id=d.application_id and c.declarer_id=da.approver_id);
  if valid_approvals < 2 and not d.hash_derived then return 'APPROVALS_REQUIRED'; end if;
  return null;
end $$;
revoke all on function rush.decision_release_blocker(text) from public, anon, authenticated;
grant execute on function rush.decision_release_blocker(text) to service_role;

create or replace function rush.decision_release_preflight(target_cycle_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare items jsonb;
begin
  if rush.actor_id() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if not rush.has_cycle_role(target_cycle_id,array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('decisionId',d.id,'applicationId',d.application_id,'outcome',d.outcome,
    'reasonCode',rush.decision_release_blocker(d.id)) order by d.id),'[]'::jsonb) into items
  from rush.decisions d where d.cycle_id=target_cycle_id and d.status='LOCKED';
  return jsonb_build_object('items',items);
end $$;
revoke all on function rush.decision_release_preflight(text) from public, anon;
grant execute on function rush.decision_release_preflight(text) to authenticated, service_role;

-- The reviewed snapshot includes every locked decision's ID and outcome. A
-- change invalidates the entire confirmation before any applicant is released.
-- Readiness is rechecked at execution; it can become blocked after preflight.
create or replace function rush.release_decision_batch(target_cycle_id text, expected_decisions jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d record; current_snapshot jsonb; expected_snapshot jsonb; reason text;
  items jsonb := '[]'::jsonb; released integer := 0; skipped integer := 0;
begin
  if rush.actor_id() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if not rush.has_cycle_role(target_cycle_id,array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode='42501'; end if;
  if expected_decisions is null or jsonb_typeof(expected_decisions)<>'array' then raise exception 'invalid release snapshot' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(expected_decisions) x where jsonb_typeof(x)<>'object'
    or jsonb_typeof(x->'decisionId') is distinct from 'string' or jsonb_typeof(x->'outcome') is distinct from 'string') then
    raise exception 'invalid release snapshot' using errcode='22023';
  end if;
  -- Serialize batch releases in this cycle. Single release's existing row lock
  -- still coordinates with these same decision locks.
  perform pg_advisory_xact_lock(hashtextextended('decision-release:' || target_cycle_id,0));
  perform 1 from rush.decisions where cycle_id=target_cycle_id and status='LOCKED' order by id for update;
  select coalesce(jsonb_agg(jsonb_build_object('decisionId',id,'outcome',outcome,'reasonCode',rush.decision_release_blocker(id)) order by id),'[]'::jsonb)
    into current_snapshot from rush.decisions where cycle_id=target_cycle_id and status='LOCKED';
  select coalesce(jsonb_agg(jsonb_build_object('decisionId',x->>'decisionId','outcome',x->>'outcome','reasonCode',x->'reasonCode') order by x->>'decisionId'),'[]'::jsonb)
    into expected_snapshot from jsonb_array_elements(expected_decisions) x;
  if current_snapshot<>expected_snapshot then raise exception 'release cohort changed; review again' using errcode='40001'; end if;
  for d in select ds.id,ds.application_id,ds.outcome from rush.decisions ds
    join jsonb_array_elements(expected_snapshot) x on x->>'decisionId'=ds.id
    where ds.cycle_id=target_cycle_id and ds.status='LOCKED' order by ds.id loop
    select x->>'reasonCode' into reason from jsonb_array_elements(expected_snapshot) x where x->>'decisionId'=d.id;
    if reason is null then reason := rush.decision_release_blocker(d.id); end if;
    if reason is null then
      begin
        -- Exception blocks are subtransactions: application + decision + outbox
        -- + audit all commit together or all roll back for this applicant.
        perform rush.release_decision(d.id);
        released := released+1;
      exception when others then
        -- Do not infer a conflict/readiness issue from an unrelated SQL error.
        -- A safe code retains the failed item for explicit recovery/retry.
        if sqlstate in ('42501','55000','P0002') then
          reason := coalesce(rush.decision_release_blocker(d.id),'RELEASE_FAILED');
        else reason := 'RELEASE_FAILED'; end if;
      end;
    end if;
    if reason is not null then skipped := skipped+1; end if;
    items := items || jsonb_build_array(jsonb_build_object('decisionId',d.id,'applicationId',d.application_id,
      'outcome',d.outcome,'reasonCode',reason));
  end loop;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
  values(rush.actor_id(),target_cycle_id,'DECISIONS_RELEASED_BATCH','RushCycle',target_cycle_id,
    jsonb_build_object('released',released,'skipped',skipped,'items',items));
  return jsonb_build_object('released',released,'skipped',skipped,'items',items);
end $$;
revoke all on function rush.release_decision_batch(text,jsonb) from public, anon;
grant execute on function rush.release_decision_batch(text,jsonb) to authenticated, service_role;

-- Existing aggregate clients keep released/skipped, now with additive items.
create or replace function rush.release_ready_decisions(target_cycle_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare snapshot jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('decisionId',x->>'decisionId','outcome',x->>'outcome','reasonCode',x->'reasonCode')),'[]'::jsonb)
    into snapshot from jsonb_array_elements(rush.decision_release_preflight(target_cycle_id)->'items') x;
  return rush.release_decision_batch(target_cycle_id,snapshot);
end $$;
revoke all on function rush.release_ready_decisions(text) from public, anon;
grant execute on function rush.release_ready_decisions(text) to authenticated, service_role;
