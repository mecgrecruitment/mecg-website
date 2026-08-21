drop policy applications_read_owner_or_internal on rush.applications;
create policy applications_read_internal on rush.applications for select to authenticated
using (
  rush.has_cycle_role(cycle_id, array['BOARD', 'PANEL', 'OWNER']::rush.member_role[])
  or exists (select 1 from rush.evaluation_assignments ea where ea.application_id=applications.id and ea.evaluator_id=auth.uid())
);
drop policy pnms_read_owner_or_internal on rush.pnms;
create policy pnms_read_internal on rush.pnms for select to authenticated
using (exists (
  select 1 from rush.applications a where a.pnm_id=pnms.id and (
    rush.has_cycle_role(a.cycle_id,array['BOARD','PANEL','OWNER']::rush.member_role[])
    or exists(select 1 from rush.evaluation_assignments ea where ea.application_id=a.id and ea.evaluator_id=auth.uid())
  )
));

create function rush.is_applicant()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from rush.pnms where auth_user_id=auth.uid());
$$;

create function rush.applicant_dashboard()
returns table(application_id text,applicant_name text,cycle_name text,display_status text,released_outcome rush.decision_outcome,released_at timestamptz)
language sql stable security definer set search_path='' as $$
  select a.id,p.name,c.name,
    case when d.id is not null then d.outcome::text when a.status in ('OFFERED','WAITLISTED','REJECTED') then 'FINAL_REVIEW' else a.status::text end,
    d.outcome,d.released_at
  from rush.pnms p join rush.applications a on a.pnm_id=p.id join rush.rush_cycles c on c.id=a.cycle_id
  left join lateral (select x.id,x.outcome,x.released_at from rush.decisions x where x.application_id=a.id and x.status='RELEASED' order by x.released_at desc limit 1) d on true
  where p.auth_user_id=auth.uid() order by a.created_at desc;
$$;
revoke all on function rush.is_applicant(),rush.applicant_dashboard() from public,anon;
grant execute on function rush.is_applicant(),rush.applicant_dashboard() to authenticated,service_role;
