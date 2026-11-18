-- Cycle records: export, archive and a retention dry run, for the cycle Owner.
--
-- Export. A cycle Owner downloads one cycle's member-tool records and the
-- organisation's project records (rush.projects is not tied to a cycle, so
-- every project and its staffing is included). Owner rank alone never unlocks
-- private member-tool content (docs/features/member-tools/README.md): for each
-- tool the export carries full content and review only when the Owner also
-- holds that tool's reviewer grant in the cycle. Otherwise it carries record
-- metadata (id, owner, dates, revision, verification and sharing status) and
-- marks the content withheld. Every export is audited with counts and which
-- tools were full, never record content.
--
-- Archive. A CLOSED cycle moves to ARCHIVED here only after an export has
-- been recorded since the cycle was closed, so nothing is archived unread.
-- rush.set_cycle_status still allows the same transition without an export;
-- this function is the guarded route the Owner page uses.
--
-- Retention. Retention periods are configuration only. Each category starts
-- unset (no Board-approved period, see 20260902120000_hold_unapproved_retention
-- .sql). The dry run counts what a period WOULD cover and returns counts only.
-- Nothing in this migration deletes, anonymises or schedules anything.
create table rush.retention_policies (
 category text primary key check (category in ('member_tool_records','audit_events')),
 keep_months integer check (keep_months between 1 and 240),
 revision integer not null default 1 check (revision >= 1),
 updated_at timestamptz not null default now(),
 updated_by uuid references rush.profiles(id) on delete set null
);
insert into rush.retention_policies(category) values ('member_tool_records'),('audit_events');
alter table rush.retention_policies enable row level security;
-- No table grants or policies: access is only through the functions below.
revoke all on rush.retention_policies from public, anon, authenticated;

-- True for an active OWNER membership in any cycle with an active profile.
-- Retention is organisation-wide, so it is not tied to one cycle's Owner.
create function rush.is_any_owner() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id
  where m.user_id=rush.actor_id() and m.active and p.active and m.role='OWNER');
$$;

-- When the cycle was archived: the latest audited move to ARCHIVED, else the
-- cycle's last update (cycles archived before audit metadata carried "to").
create function rush.cycle_archived_at(c text) returns timestamptz
language sql stable security definer set search_path='' as $$
 select case when rc.status='ARCHIVED' then coalesce(
  (select max(a.created_at) from rush.audit_events a where a.cycle_id=c and a.action='CYCLE_STATUS_CHANGED' and a.metadata->>'to'='ARCHIVED'),
  rc.updated_at) end
 from rush.rush_cycles rc where rc.id=c;
$$;

-- The latest export recorded since the cycle was last closed, or null.
create function rush.cycle_export_since_close(c text) returns timestamptz
language sql stable security definer set search_path='' as $$
 select max(e.created_at) from rush.audit_events e
 where e.cycle_id=c and e.action='CYCLE_RECORDS_EXPORTED'
  and e.created_at >= coalesce((select max(s.created_at) from rush.audit_events s
   where s.cycle_id=c and s.action='CYCLE_STATUS_CHANGED' and s.metadata->>'to'='CLOSED'), '-infinity'::timestamptz);
$$;

create function rush.cycle_records_overview(c text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare cycle_row rush.rush_cycles%rowtype;
begin
 if not rush.has_cycle_role(c,array['OWNER']::rush.member_role[]) then raise exception 'Owner access required' using errcode='42501'; end if;
 select * into cycle_row from rush.rush_cycles where id=c;
 if not found then raise exception 'Cycle not found' using errcode='P0002'; end if;
 return jsonb_build_object(
  'cycle', jsonb_build_object('id',cycle_row.id,'name',cycle_row.name,'status',cycle_row.status,'archivedAt',rush.cycle_archived_at(c)),
  'tools', (select jsonb_agg(jsonb_build_object('kind',k,'records',(select count(*) from rush.member_tool_records r where r.cycle_id=c and r.kind=k),
    'full', exists(select 1 from rush.member_tool_reviewers g where g.cycle_id=c and g.kind=k and g.user_id=rush.actor_id())) order by ord)
   from unnest(array['pipeline','evidence','lab']) with ordinality as t(k,ord)),
  'projects', (select count(*) from rush.projects),
  'lastExportAt', (select max(e.created_at) from rush.audit_events e where e.cycle_id=c and e.action='CYCLE_RECORDS_EXPORTED'),
  'exportedSinceClose', rush.cycle_export_since_close(c));
end; $$;

create function rush.export_cycle_records(c text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=rush.actor_id(); full_kinds text[]; result jsonb; cycle_row rush.rush_cycles%rowtype;
begin
 if not rush.has_cycle_role(c,array['OWNER']::rush.member_role[]) then raise exception 'Owner access required' using errcode='42501'; end if;
 select * into cycle_row from rush.rush_cycles where id=c;
 if not found then raise exception 'Cycle not found' using errcode='P0002'; end if;
 select coalesce(array_agg(g.kind order by g.kind),'{}') into full_kinds from rush.member_tool_reviewers g where g.cycle_id=c and g.user_id=actor;
 result:=jsonb_build_object(
  'format','mecg-cycle-records/1',
  'exportedAt',now(),
  'cycle',jsonb_build_object('id',cycle_row.id,'name',cycle_row.name,'status',cycle_row.status),
  'fullContentTools',to_jsonb(full_kinds),
  'memberToolRecords',coalesce((select jsonb_agg(jsonb_build_object(
    'id',r.id,'kind',r.kind,'ownerId',r.owner_id,'ownerName',(select p.display_name from rush.profiles p where p.id=r.owner_id),
    'revision',r.revision,'createdAt',r.created_at,'updatedAt',r.updated_at,
    'verification',r.review->>'verification','sharing',r.review->>'sharing',
    'contentWithheld',not (r.kind=any(full_kinds)),
    'content',case when r.kind=any(full_kinds) then r.content end,
    'review',case when r.kind=any(full_kinds) then r.review end) order by r.kind, r.created_at, r.id)
   from rush.member_tool_records r where r.cycle_id=c),'[]'::jsonb),
  'reviewerGrants',coalesce((select jsonb_agg(jsonb_build_object('kind',g.kind,'userId',g.user_id,'name',(select p.display_name from rush.profiles p where p.id=g.user_id)) order by g.kind, g.user_id)
   from rush.member_tool_reviewers g where g.cycle_id=c),'[]'::jsonb),
  'projects',coalesce((select jsonb_agg(to_jsonb(pr) order by pr.sort_order, pr.id) from rush.projects pr),'[]'::jsonb),
  'projectMembers',coalesce((select jsonb_agg(jsonb_build_object('projectId',pm.project_id,'userId',pm.user_id,'name',(select p.display_name from rush.profiles p where p.id=pm.user_id),'roleLabel',pm.role_label) order by pm.project_id, pm.user_id)
   from rush.project_members pm),'[]'::jsonb));
 insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
 values(actor,c,'CYCLE_RECORDS_EXPORTED','RushCycle',c,jsonb_build_object(
  'memberToolRecords',jsonb_array_length(result->'memberToolRecords'),
  'projects',jsonb_array_length(result->'projects'),
  'fullContentTools',to_jsonb(full_kinds)));
 return result;
end; $$;

create function rush.archive_cycle_records(c text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare current_status text;
begin
 if not rush.has_cycle_role(c,array['OWNER']::rush.member_role[]) then raise exception 'Owner access required' using errcode='42501'; end if;
 select status::text into current_status from rush.rush_cycles where id=c for update;
 if current_status is null then raise exception 'Cycle not found' using errcode='P0002'; end if;
 if current_status='ARCHIVED' then return jsonb_build_object('status','ARCHIVED','changed',false); end if;
 if current_status<>'CLOSED' then raise exception 'Close the cycle before archiving it' using errcode='55000'; end if;
 if rush.cycle_export_since_close(c) is null then raise exception 'Export the cycle records before archiving' using errcode='55000'; end if;
 update rush.rush_cycles set status='ARCHIVED' where id=c;
 insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
 values(rush.actor_id(),c,'CYCLE_STATUS_CHANGED','RushCycle',c,jsonb_build_object('from','CLOSED','to','ARCHIVED','via','cycle_records'));
 return jsonb_build_object('status','ARCHIVED','changed',true);
end; $$;

create function rush.retention_report() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not rush.is_any_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
 return jsonb_build_object('generatedAt',now(),'categories',(select jsonb_agg(jsonb_build_object(
  'category',rp.category,'keepMonths',rp.keep_months,'revision',rp.revision,'updatedAt',rp.updated_at,
  'eligible',case when rp.keep_months is null then null
   when rp.category='member_tool_records' then (select count(*) from rush.member_tool_records r
    where rush.cycle_archived_at(r.cycle_id) < now() - make_interval(months=>rp.keep_months))
   else (select count(*) from rush.audit_events a where a.created_at < now() - make_interval(months=>rp.keep_months)) end,
  'byCycle',case when rp.keep_months is not null and rp.category='member_tool_records' then coalesce((select jsonb_agg(jsonb_build_object(
    'cycleId',x.cycle_id,'cycleName',x.name,'archivedAt',x.archived_at,'records',x.records) order by x.archived_at, x.cycle_id) from (
     select r.cycle_id, rc.name, rush.cycle_archived_at(r.cycle_id) archived_at, count(*) records
     from rush.member_tool_records r join rush.rush_cycles rc on rc.id=r.cycle_id
     where rush.cycle_archived_at(r.cycle_id) < now() - make_interval(months=>rp.keep_months)
     group by r.cycle_id, rc.name) x),'[]'::jsonb) end) order by rp.category)
  from rush.retention_policies rp));
end; $$;

create function rush.save_retention_policy(target_category text, months integer, expected_revision integer) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare row_now rush.retention_policies%rowtype;
begin
 if not rush.is_any_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
 if months is not null and months not between 1 and 240 then raise exception 'Keep for 1 to 240 months, or leave blank' using errcode='22023'; end if;
 select * into row_now from rush.retention_policies where category=target_category for update;
 if not found then raise exception 'Unknown retention category' using errcode='22023'; end if;
 if expected_revision is distinct from row_now.revision then raise exception 'This policy changed. Reload before saving.' using errcode='40001'; end if;
 if row_now.keep_months is not distinct from months then return jsonb_build_object('revision',row_now.revision,'changed',false); end if;
 update rush.retention_policies set keep_months=months, revision=revision+1, updated_at=now(), updated_by=rush.actor_id()
 where category=target_category returning * into row_now;
 insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
 values(rush.actor_id(),null,'RETENTION_POLICY_CHANGED','RetentionPolicy',target_category,jsonb_build_object('keepMonths',months,'revision',row_now.revision));
 return jsonb_build_object('revision',row_now.revision,'changed',true);
end; $$;

revoke all on function rush.is_any_owner(), rush.cycle_archived_at(text), rush.cycle_export_since_close(text), rush.cycle_records_overview(text),
 rush.export_cycle_records(text), rush.archive_cycle_records(text), rush.retention_report(), rush.save_retention_policy(text,integer,integer) from public, anon, authenticated;
grant execute on function rush.cycle_records_overview(text), rush.export_cycle_records(text), rush.archive_cycle_records(text),
 rush.retention_report(), rush.save_retention_policy(text,integer,integer) to authenticated;
