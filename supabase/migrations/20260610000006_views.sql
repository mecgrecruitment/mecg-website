-- Phase 0 · Migration 6: derived views (PRD §10.3, reconciliation I4)
-- Composites/normalization/controversy live in views, never base columns.
--
-- Layering: *_internal views are definer-rights with NO grants — they compute
-- over the full data set (normalization stats must see every submitted score).
-- Public-facing views apply the blind/role predicates explicitly and are the
-- only granted surfaces. Supabase default privileges auto-grant on new
-- relations, so every view gets explicit REVOKE/GRANT below.

-- ── Full composite per (candidate, evaluator, stage) with a submission ──────
-- DM-25: weighted mean over the submission's rubric version; COI-excluded
-- evaluators filtered out.
create view public.v_score_composite_internal as
select
  ss.candidate_id,
  ss.evaluator_id,
  ss.stage,
  ss.rubric_version_id,
  c.cycle_id,
  sum(s.value * rc.weight) / sum(rc.weight) as composite_raw
from public.score_submissions ss
join public.candidates c on c.id = ss.candidate_id
join public.scores s
  on s.candidate_id = ss.candidate_id
 and s.evaluator_id = ss.evaluator_id
 and s.stage = ss.stage
 and s.rubric_version_id = ss.rubric_version_id
join public.rubric_criteria rc on rc.id = s.rubric_criterion_id
where not exists (
  select 1 from public.coi_flags cf
  where cf.candidate_id = ss.candidate_id
    and cf.member_id = ss.evaluator_id
    and cf.is_excluded_from_agg
)
group by ss.candidate_id, ss.evaluator_id, ss.stage, ss.rubric_version_id, c.cycle_id;

revoke all on public.v_score_composite_internal from anon, authenticated;

-- ── DM-26: evaluator calibration stats (sample stddev, n−1; K2) ─────────────
create materialized view public.mv_evaluator_stage_stats as
select
  evaluator_id,
  stage,
  cycle_id,
  count(*)::integer as n,
  avg(composite_raw) as mu,
  stddev_samp(composite_raw) as sigma
from public.v_score_composite_internal
group by evaluator_id, stage, cycle_id;

-- Required for a future REFRESH ... CONCURRENTLY upgrade (Track B4).
create unique index mv_evaluator_stage_stats_key
  on public.mv_evaluator_stage_stats (evaluator_id, stage, cycle_id);

revoke all on public.mv_evaluator_stage_stats from anon, authenticated;

-- Non-concurrent refresh: CONCURRENTLY cannot run inside a trigger's
-- transaction. Fine at club scale; revisit as a background job in Track B4.
create or replace function public.fn_refresh_evaluator_stage_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.mv_evaluator_stage_stats;
  return null;
end;
$$;

create trigger trg_refresh_evaluator_stats
  after insert on public.score_submissions
  for each statement execute function public.fn_refresh_evaluator_stage_stats();

-- ── Blind/role-gated composite surface ──────────────────────────────────────
-- Mirrors the scores RLS predicate: own rows, board, or unlocked-by-submission.
create view public.v_score_composite as
select vc.*
from public.v_score_composite_internal vc
where public.is_committee_or_above()
  and (
    vc.evaluator_id = public.current_member_id()
    or public.is_board()
    or public.has_submitted_for(vc.candidate_id, vc.stage)
  );

revoke all on public.v_score_composite from anon;
grant select on public.v_score_composite to authenticated;

-- ── DM-27: z-scores + panel aggregates ──────────────────────────────────────
-- n = 1 → z NULL ("Not normalizable"); σ = 0 → z = 0 ("Zero-variance evaluator").
-- Panel aggregates are masked until the caller has submitted (or is board).
create view public.v_score_normalized as
with z as (
  select
    vc.candidate_id,
    vc.evaluator_id,
    vc.stage,
    vc.cycle_id,
    vc.composite_raw,
    case
      when st.n = 1 then null
      when st.sigma = 0 then 0
      else (vc.composite_raw - st.mu) / st.sigma
    end as z
  from public.v_score_composite_internal vc
  join public.mv_evaluator_stage_stats st
    on st.evaluator_id = vc.evaluator_id
   and st.stage = vc.stage
   and st.cycle_id = vc.cycle_id
),
panel as (
  select
    z.*,
    avg(z.z) over (partition by z.candidate_id, z.stage) as panel_composite_normalized_all,
    avg(z.composite_raw) over (partition by z.candidate_id, z.stage) as panel_composite_raw_all,
    count(*) over (partition by z.candidate_id, z.stage) as panel_evaluator_count_all
  from z
)
select
  p.candidate_id,
  p.evaluator_id,
  p.stage,
  p.cycle_id,
  p.composite_raw,
  p.z,
  case when public.is_board() or public.has_submitted_for(p.candidate_id, p.stage)
       then p.panel_composite_normalized_all end as panel_composite_normalized,
  case when public.is_board() or public.has_submitted_for(p.candidate_id, p.stage)
       then p.panel_composite_raw_all end as panel_composite_raw,
  case when public.is_board() or public.has_submitted_for(p.candidate_id, p.stage)
       then p.panel_evaluator_count_all end as panel_evaluator_count
from panel p
where public.is_committee_or_above()
  and (
    p.evaluator_id = public.current_member_id()
    or public.is_board()
    or public.has_submitted_for(p.candidate_id, p.stage)
  );

revoke all on public.v_score_normalized from anon;
grant select on public.v_score_normalized to authenticated;

-- ── DM-28: controversy per (candidate, stage) ───────────────────────────────
-- stddev of z over counted evaluators; falls back to reaction-encoding stddev
-- (strong_yes +2 / yes +1 / no −1 / strong_no −2) when z unavailable.
-- Hash default sort = controversy DESC, panel_composite_normalized DESC.
create view public.v_candidate_controversy as
with z as (
  select
    vc.candidate_id,
    vc.stage,
    vc.cycle_id,
    vc.composite_raw,
    case
      when st.n = 1 then null
      when st.sigma = 0 then 0
      else (vc.composite_raw - st.mu) / st.sigma
    end as z
  from public.v_score_composite_internal vc
  join public.mv_evaluator_stage_stats st
    on st.evaluator_id = vc.evaluator_id
   and st.stage = vc.stage
   and st.cycle_id = vc.cycle_id
)
select
  z.candidate_id,
  z.stage,
  z.cycle_id,
  coalesce(
    stddev_samp(z.z),
    (
      select stddev_samp(
        case r.value
          when 'strong_yes' then 2.0
          when 'yes' then 1.0
          when 'no' then -1.0
          when 'strong_no' then -2.0
        end
      )
      from public.reactions r
      where r.candidate_id = z.candidate_id and r.stage = z.stage
    )
  ) as controversy,
  min(z.z) as evaluator_min_normalized,
  max(z.z) as evaluator_max_normalized,
  avg(z.composite_raw) as panel_composite_raw,
  avg(z.z) as panel_composite_normalized
from z
where public.is_board() or public.has_submitted_for(z.candidate_id, z.stage)
group by z.candidate_id, z.stage, z.cycle_id;

revoke all on public.v_candidate_controversy from anon;
grant select on public.v_candidate_controversy to authenticated;

-- ── J1/DM-30: general-member roster surface ─────────────────────────────────
-- The ONLY candidate surface for general members; open-rush cycles only;
-- coarse status; no evaluation columns, no pronouns anywhere.
create view public.v_candidate_roster as
select
  c.id,
  c.cycle_id,
  'C' || lpad(c.per_cycle_seq::text, 2, '0') as display_code,
  c.full_name,
  c.year,
  c.major,
  case
    when c.status in ('cut', 'withdrawn', 'accepted', 'rejected', 'waitlisted') then 'Closed'
    when c.current_stage = 'applied' and c.status = 'active' then 'Applied'
    else 'In process'
  end as status
from public.candidates c
join public.recruitment_cycles rc on rc.id = c.cycle_id
where rc.is_open_rush
  and c.deleted_at is null
  and public.is_member_or_above();

revoke all on public.v_candidate_roster from anon;
grant select on public.v_candidate_roster to authenticated;

-- ── EX-35/DM-30: public team surface ────────────────────────────────────────
create view public.v_team_public as
select
  m.id,
  m.full_name,
  m.preferred_name,
  m.role,
  m.year,
  m.major,
  m.bio,
  m.photo_storage_path,
  m.linkedin_url
from public.members m
where m.is_public and m.deleted_at is null;

grant select on public.v_team_public to anon, authenticated;

-- ── EX-24/DM-30: public placement surface ───────────────────────────────────
-- Curated placement_features rows (manual, or member-linked with consent) plus
-- consenting members with a current company not already curated.
create view public.v_placement_public as
select
  pf.id,
  pf.company,
  pf.role_title,
  pf.term,
  pf.quote,
  pf.logo_storage_path,
  pf.sort_order,
  pf.is_featured,
  case when m.placement_consent then m.full_name end as member_name
from public.placement_features pf
left join public.members m on m.id = pf.member_id and m.deleted_at is null
where pf.member_id is null or m.placement_consent
union all
select
  m.id,
  m.current_company,
  m.current_role_title,
  null,
  null,
  null,
  0,
  false,
  m.full_name
from public.members m
where m.placement_consent
  and m.deleted_at is null
  and m.current_company is not null
  and not exists (
    select 1 from public.placement_features pf2 where pf2.member_id = m.id
  );

grant select on public.v_placement_public to anon, authenticated;

-- ── I2/DM-30: aggregate vote surface without voter_id ───────────────────────
-- Current vote = latest row per (session, candidate, voter). Committee+ only.
create view public.vote_counts as
with latest as (
  select distinct on (v.session_id, v.candidate_id, v.voter_id)
    v.session_id, v.candidate_id, v.voter_id, v.value
  from public.votes v
  order by v.session_id, v.candidate_id, v.voter_id, v.created_at desc
)
select
  l.session_id,
  l.candidate_id,
  l.value,
  count(*)::integer as count
from latest l
where public.is_committee_or_above()
group by l.session_id, l.candidate_id, l.value;

revoke all on public.vote_counts from anon;
grant select on public.vote_counts to authenticated;

-- v_impact_stats (EX-19) intentionally deferred — optional, config-based.
