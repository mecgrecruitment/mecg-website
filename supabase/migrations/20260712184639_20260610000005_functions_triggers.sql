-- Phase 0 · Migration 5: helper functions + triggers (PRD §11.3, §10.5, §11.2, §9.12)

-- ─────────────────────────────────────────────────────────────────────────────
-- Security-definer helpers (SEC-10–SEC-14, reconciliation A2).
-- Role is resolved at query time, never embedded in the JWT.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.current_member_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.members
  where user_id = auth.uid() and deleted_at is null;
$$;

create or replace function public.current_member_role()
returns public.member_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.members
  where user_id = auth.uid() and deleted_at is null;
$$;

create or replace function public.is_board()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_member_role() = 'board';
$$;

create or replace function public.is_committee_or_above()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_member_role() in ('board', 'recruitment_committee');
$$;

create or replace function public.is_member_or_above()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_member_role() is not null;
$$;

-- Blind-unlock predicate (B): TRUE once the caller has submitted for (candidate, stage).
create or replace function public.has_submitted_for(p_candidate_id uuid, p_stage public.candidate_stage)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.score_submissions ss
    where ss.candidate_id = p_candidate_id
      and ss.stage = p_stage
      and ss.evaluator_id = public.current_member_id()
  );
$$;

create or replace function public.session_is_open(p_session_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select visibility = 'open' from public.hash_sessions where id = p_session_id;
$$;

create or replace function public.session_is_active(p_session_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select is_active from public.hash_sessions where id = p_session_id;
$$;

revoke execute on function
  public.current_member_id(),
  public.current_member_role(),
  public.is_board(),
  public.is_committee_or_above(),
  public.is_member_or_above(),
  public.has_submitted_for(uuid, public.candidate_stage),
  public.session_is_open(uuid),
  public.session_is_active(uuid)
from anon, public;

grant execute on function
  public.current_member_id(),
  public.current_member_role(),
  public.is_board(),
  public.is_committee_or_above(),
  public.is_member_or_above(),
  public.has_submitted_for(uuid, public.candidate_stage),
  public.session_is_open(uuid),
  public.session_is_active(uuid)
to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at maintenance
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_members_updated_at before update on public.members
  for each row execute function public.fn_set_updated_at();
create trigger trg_recruitment_cycles_updated_at before update on public.recruitment_cycles
  for each row execute function public.fn_set_updated_at();
create trigger trg_candidates_updated_at before update on public.candidates
  for each row execute function public.fn_set_updated_at();
create trigger trg_scores_updated_at before update on public.scores
  for each row execute function public.fn_set_updated_at();
create trigger trg_notes_updated_at before update on public.notes
  for each row execute function public.fn_set_updated_at();
create trigger trg_reactions_updated_at before update on public.reactions
  for each row execute function public.fn_set_updated_at();
create trigger trg_coi_flags_updated_at before update on public.coi_flags
  for each row execute function public.fn_set_updated_at();
create trigger trg_hash_sessions_updated_at before update on public.hash_sessions
  for each row execute function public.fn_set_updated_at();
create trigger trg_placement_features_updated_at before update on public.placement_features
  for each row execute function public.fn_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Append-only enforcement (applies to every role, including service_role)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_deny_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only; % is not permitted', tg_table_name, tg_op;
end;
$$;

create trigger trg_application_responses_append_only before update or delete on public.application_responses
  for each row execute function public.fn_deny_mutation();
create trigger trg_score_submissions_append_only before update or delete on public.score_submissions
  for each row execute function public.fn_deny_mutation();
create trigger trg_stage_transitions_append_only before update or delete on public.stage_transitions
  for each row execute function public.fn_deny_mutation();
create trigger trg_votes_append_only before update or delete on public.votes
  for each row execute function public.fn_deny_mutation();
create trigger trg_decisions_append_only before update or delete on public.decisions
  for each row execute function public.fn_deny_mutation();
create trigger trg_audit_log_append_only before update or delete on public.audit_log
  for each row execute function public.fn_deny_mutation();

-- ─────────────────────────────────────────────────────────────────────────────
-- Candidate per-cycle sequence (display_code C01, C02, …)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_assign_per_cycle_seq()
returns trigger
language plpgsql
as $$
begin
  -- Lock the cycle row to serialize concurrent intake.
  perform 1 from public.recruitment_cycles where id = new.cycle_id for update;
  select coalesce(max(per_cycle_seq), 0) + 1
    into new.per_cycle_seq
    from public.candidates
   where cycle_id = new.cycle_id;
  return new;
end;
$$;

create trigger trg_candidates_per_cycle_seq before insert on public.candidates
  for each row execute function public.fn_assign_per_cycle_seq();

-- ─────────────────────────────────────────────────────────────────────────────
-- Stage lock (D1): scores/reactions/notes frozen once a decision exists for
-- (candidate, stage). Board re-open path is Track B8.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_enforce_stage_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
      from public.decisions d
      join public.hash_sessions hs on hs.id = d.session_id
     where d.candidate_id = new.candidate_id
       and hs.stage = new.stage
  ) then
    raise exception 'stage % is locked for candidate %: a decision has been recorded', new.stage, new.candidate_id;
  end if;
  return new;
end;
$$;

create trigger trg_scores_stage_lock before update on public.scores
  for each row execute function public.fn_enforce_stage_lock();
create trigger trg_reactions_stage_lock before update on public.reactions
  for each row execute function public.fn_enforce_stage_lock();
create trigger trg_notes_stage_lock before update on public.notes
  for each row execute function public.fn_enforce_stage_lock();

-- ─────────────────────────────────────────────────────────────────────────────
-- Role freeze on members (ATS-2): only board changes roles. RLS WITH CHECK
-- cannot reference OLD, so this lives in a trigger. auth.uid() IS NULL means a
-- direct admin/service connection (seeds, migrations) — allowed.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_freeze_member_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not coalesce(public.is_board(), false) then
    raise exception 'only board can change member roles';
  end if;
  return new;
end;
$$;

create trigger trg_members_role_freeze before update on public.members
  for each row execute function public.fn_freeze_member_role();

-- ─────────────────────────────────────────────────────────────────────────────
-- Signup gating (§11.2, SEC-4–SEC-6): @umich.edu AND a valid allowlist row.
-- NOTE: DB triggers on auth.users work on local/CLI stacks (migrations run as
-- superuser). For a hosted Supabase deploy, move the gate to a "before user
-- created" Auth Hook — keep the AFTER INSERT member-row creation either way.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_enforce_signup_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) not like '%@umich.edu' then
    raise exception 'Signup is not available for this email.';
  end if;

  if not exists (
    select 1 from public.invite_allowlist ia
    where lower(ia.email) = lower(new.email)
      and ia.consumed_at is null
      and (ia.expires_at is null or ia.expires_at > now())
  ) then
    raise exception 'Signup is not available for this email.';
  end if;

  return new;
end;
$$;

create trigger trg_auth_users_signup_gate before insert on auth.users
  for each row execute function public.fn_enforce_signup_gate();

create or replace function public.fn_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow public.invite_allowlist%rowtype;
begin
  select * into v_allow
    from public.invite_allowlist ia
   where lower(ia.email) = lower(new.email)
     and ia.consumed_at is null
     and (ia.expires_at is null or ia.expires_at > now())
   limit 1;

  insert into public.members (user_id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      initcap(replace(split_part(new.email, '@', 1), '.', ' '))
    ),
    coalesce(v_allow.role, 'general_member')
  );

  update public.invite_allowlist
     set consumed_at = now()
   where id = v_allow.id;

  return new;
end;
$$;

create trigger trg_auth_users_create_member after insert on auth.users
  for each row execute function public.fn_handle_new_auth_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Audit trail (§9.12 Phase-0 subset). SECURITY DEFINER so the insert bypasses
-- audit_log's board-only RLS. stage_transitions is itself a funnel record and
-- score_edit_reopened is Track B8 — neither is audited here.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_member_id();
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_entity_id uuid := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
  v_cycle uuid := coalesce((v_new ->> 'cycle_id')::uuid, (v_old ->> 'cycle_id')::uuid);
begin
  if tg_table_name = 'members' and tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'member_role_changed', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
    end if;
    if old.deleted_at is null and new.deleted_at is not null then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'member_soft_deleted', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
    end if;

  elsif tg_table_name = 'invite_allowlist' then
    if tg_op = 'INSERT' then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'invite_created', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
    elsif tg_op = 'UPDATE' and old.consumed_at is null and new.consumed_at is not null then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'invite_consumed', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
    end if;

  elsif tg_table_name = 'recruitment_cycles' then
    if tg_op = 'INSERT' then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'cycle_created', tg_table_name, v_entity_id, new.id, v_old, v_new);
    elsif tg_op = 'UPDATE' and new.is_open_rush is distinct from old.is_open_rush then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'cycle_open_rush_toggled', tg_table_name, v_entity_id, new.id, v_old, v_new);
    end if;

  elsif tg_table_name = 'candidates' then
    if tg_op = 'INSERT' then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'candidate_created', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
    elsif tg_op = 'UPDATE' then
      if new.current_stage is distinct from old.current_stage then
        insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
        values (v_actor, 'candidate_stage_advanced', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
      end if;
      if new.status is distinct from old.status then
        insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
        values (v_actor, 'candidate_status_changed', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
      end if;
    end if;

  elsif tg_table_name = 'score_submissions' and tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
    values (v_actor, 'score_submitted', tg_table_name, v_entity_id, v_cycle, v_old, v_new);

  elsif tg_table_name = 'scores' then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
    values (v_actor, 'score_saved', tg_table_name, v_entity_id, v_cycle, v_old, v_new);

  elsif tg_table_name = 'notes' then
    if tg_op = 'INSERT' then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'note_created', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
    elsif old.deleted_at is null and new.deleted_at is not null then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'note_soft_deleted', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
    else
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'note_updated', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
    end if;

  elsif tg_table_name = 'reactions' then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
    values (v_actor, 'reaction_set', tg_table_name, v_entity_id, v_cycle, v_old, v_new);

  elsif tg_table_name = 'coi_flags' then
    if tg_op = 'INSERT' then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'coi_flagged', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
    elsif new.is_excluded_from_agg is distinct from old.is_excluded_from_agg then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'coi_exclusion_toggled', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
    end if;

  elsif tg_table_name = 'evaluator_assignments' and tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
    values (v_actor, 'evaluator_assigned', tg_table_name, v_entity_id, v_cycle, v_old, v_new);

  elsif tg_table_name = 'hash_sessions' then
    if tg_op = 'INSERT' then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'hash_session_started', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
    elsif tg_op = 'UPDATE' then
      if new.visibility is distinct from old.visibility then
        insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
        values (v_actor, 'hash_visibility_changed', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
      end if;
      if old.ended_at is null and new.ended_at is not null then
        insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
        values (v_actor, 'hash_session_ended', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
      end if;
    end if;

  elsif tg_table_name = 'hash_session_participants' and tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
    values (v_actor, 'hash_participant_added', tg_table_name, v_entity_id, v_cycle, v_old, v_new);

  elsif tg_table_name = 'votes' and tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
    values (v_actor, 'vote_cast', tg_table_name, v_entity_id, v_cycle, v_old, v_new);

  elsif tg_table_name = 'decisions' and tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
    values (v_actor, 'decision_recorded', tg_table_name, v_entity_id, v_cycle, v_old, v_new);

  elsif tg_table_name = 'rubric_versions' then
    if tg_op = 'INSERT' then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'rubric_version_created', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
    elsif tg_op = 'UPDATE' and not old.is_active and new.is_active then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, cycle_id, before_state, after_state)
      values (v_actor, 'rubric_version_activated', tg_table_name, v_entity_id, v_cycle, v_old, v_new);
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_members_audit after update on public.members
  for each row execute function public.fn_audit();
create trigger trg_invite_allowlist_audit after insert or update on public.invite_allowlist
  for each row execute function public.fn_audit();
create trigger trg_recruitment_cycles_audit after insert or update on public.recruitment_cycles
  for each row execute function public.fn_audit();
create trigger trg_candidates_audit after insert or update on public.candidates
  for each row execute function public.fn_audit();
create trigger trg_score_submissions_audit after insert on public.score_submissions
  for each row execute function public.fn_audit();
create trigger trg_scores_audit after insert or update on public.scores
  for each row execute function public.fn_audit();
create trigger trg_notes_audit after insert or update on public.notes
  for each row execute function public.fn_audit();
create trigger trg_reactions_audit after insert or update on public.reactions
  for each row execute function public.fn_audit();
create trigger trg_coi_flags_audit after insert or update on public.coi_flags
  for each row execute function public.fn_audit();
create trigger trg_evaluator_assignments_audit after insert on public.evaluator_assignments
  for each row execute function public.fn_audit();
create trigger trg_hash_sessions_audit after insert or update on public.hash_sessions
  for each row execute function public.fn_audit();
create trigger trg_hash_session_participants_audit after insert on public.hash_session_participants
  for each row execute function public.fn_audit();
create trigger trg_votes_audit after insert on public.votes
  for each row execute function public.fn_audit();
create trigger trg_decisions_audit after insert on public.decisions
  for each row execute function public.fn_audit();
create trigger trg_rubric_versions_audit after insert or update on public.rubric_versions
  for each row execute function public.fn_audit();
;
