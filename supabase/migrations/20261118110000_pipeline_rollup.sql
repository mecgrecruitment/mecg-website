-- Board opportunity rollup: counts of the cycle's member pipeline records
-- (rush.member_tool_records kind 'pipeline') by stage and track, and how many
-- open records have a next-action date before today (America/Detroit).
--
-- Access is only through the actor-checked function below. An active BOARD or
-- OWNER member of the cycle reads the counts. Board rank alone returns counts
-- only: no titles, owners, problems, links, dates or record ids. The overdue
-- record list (id, title, stage, track, next-action date, owner name) is added
-- only when the caller already holds pipeline reviewer access for the cycle
-- (rush.member_tool_reviewer), which already lets them read every pipeline
-- record in /member/tools/pipeline. No table, no writes, nothing to audit.
create function rush.pipeline_rollup(target_cycle_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 -- Same order as the member pipeline form (src/lib/member-tools/model.ts) and
 -- rush.validate_member_tool_content.
 stages text[] := array['Research','Qualified','Conversation','Proposal','Agreed','Dormant','Closed'];
 tracks text[] := array['Client','Sponsor'];
 today date := (now() at time zone 'America/Detroit')::date;
 reviewer boolean;
begin
 if target_cycle_id is null or not rush.has_cycle_role(target_cycle_id,array['BOARD','OWNER']::rush.member_role[]) then
  raise exception 'Board access required' using errcode='42501'; end if;
 reviewer := rush.member_tool_reviewer(target_cycle_id,'pipeline');
 return (
  with records as (
   select r.id, r.owner_id, r.content->>'title' as title, r.content->>'stage' as stage, r.content->>'track' as track,
    r.content->>'nextDate' as next_date,
    -- Saves validate the date; the guard keeps one bad stored value from
    -- failing the whole rollup (CASE, so the cast only runs on a valid date).
    case when coalesce(r.content->>'stage','')='Closed' then false
     when coalesce(r.content->>'nextDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then false
     when not pg_input_is_valid(r.content->>'nextDate','date') then false
     else (r.content->>'nextDate')::date<today end as is_overdue
   from rush.member_tool_records r where r.cycle_id=target_cycle_id and r.kind='pipeline'),
  classified as (select * from records where stage=any(stages) and track=any(tracks)),
  grid as (
   select s.stage, s.ord as stage_ord, t.track, t.ord as track_ord,
    count(c.id) as n, count(c.id) filter (where c.is_overdue) as overdue
   from unnest(stages) with ordinality s(stage,ord) cross join unnest(tracks) with ordinality t(track,ord)
   left join classified c on c.stage=s.stage and c.track=t.track
   group by s.stage, s.ord, t.track, t.ord)
  select jsonb_build_object(
   'cycleId',target_cycle_id,
   'asOf',to_char(today,'YYYY-MM-DD'),
   'total',(select count(*) from records),
   'overdue',(select count(*) from classified where is_overdue),
   'unclassified',(select count(*) from records where not (coalesce(stage,'')=any(stages) and coalesce(track,'')=any(tracks))),
   'canReview',reviewer,
   'cells',(select jsonb_agg(jsonb_build_object('stage',g.stage,'track',g.track,'count',g.n,'overdue',g.overdue) order by g.stage_ord, g.track_ord) from grid g),
   'overdueRecords',case when reviewer then coalesce((
    select jsonb_agg(jsonb_build_object('id',c.id::text,'title',coalesce(c.title,''),'stage',c.stage,'track',c.track,'nextDate',c.next_date,
     'ownerName',coalesce((select p.display_name from rush.profiles p where p.id=c.owner_id),'')) order by c.next_date, c.title, c.id)
    from classified c where c.is_overdue),'[]'::jsonb) else null end));
end; $$;

revoke all on function rush.pipeline_rollup(text) from public, anon, authenticated;
grant execute on function rush.pipeline_rollup(text) to authenticated;
