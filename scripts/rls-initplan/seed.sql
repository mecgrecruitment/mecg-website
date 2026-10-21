-- Synthetic data for the RLS equivalence harness. Every SELECT policy branch
-- is true for some (actor, row) pair and false for others. Also large enough
-- (300+ applications, 80+ memberships, 2000+ evaluation assignments) for the
-- EXPLAIN comparison to mean something.
--
-- Runs as postgres with triggers and foreign-key enforcement off so rows can
-- be placed directly in the states the policies branch on (locked evaluations,
-- published batches, withdrawn applications) without replaying every RPC.
-- Rows still reference each other consistently.

\set ON_ERROR_STOP on
set session_replication_role = replica;

-- Policies branch on cycle status, so the harness needs several non-terminal
-- cycles at once. Production allows one; that rule is not under test here.
drop index if exists rush.rush_cycles_one_non_terminal_idx;

create schema if not exists harness;
drop table if exists harness.identities;
create table harness.identities (label text primary key, db_role text not null, claims text not null);

-- Cycles
insert into rush.rush_cycles (id, name, status) values
  ('c_open',   'Harness open',          'OPEN'),
  ('c_lock',   'Harness decision lock', 'DECISION_LOCK'),
  ('c_closed', 'Harness closed',        'CLOSED'),
  ('c_arch',   'Harness archived',      'ARCHIVED'),
  ('c_inproc', 'Harness in process',    'IN_PROCESS'),
  ('c_draft',  'Harness draft',         'DRAFT');

-- People. uuid suffix = identity number.
create temporary table ppl (n int primary key, label text, uid uuid, active boolean default true, identity text default 'enabled');
insert into ppl (n, label, active, identity) values
  (1,  'owner_all', true, 'enabled'),
  (2,  'board_open', true, 'enabled'),
  (3,  'panel_lock', true, 'enabled'),
  (4,  'member_open', true, 'enabled'),
  (5,  'rc_open_reviewer', true, 'enabled'),
  (6,  'rc_closed', true, 'enabled'),
  (7,  'rc_draft_batch', true, 'enabled'),
  (8,  'rc_panel_lock', true, 'enabled'),
  (9,  'inactive_membership', true, 'enabled'),
  (10, 'inactive_profile', false, 'enabled'),
  (11, 'disabled_identity', true, 'disabled'),
  (12, 'no_identity', true, 'none'),
  (13, 'evaluator', true, 'enabled'),
  (14, 'panel_lock_conflict', true, 'enabled'),
  (15, 'rc_inproc_reviewer', true, 'enabled'),
  (16, 'applicant_open_submitted', true, 'enabled'),
  (17, 'applicant_open_draft', true, 'enabled'),
  (18, 'applicant_lock', true, 'enabled'),
  (19, 'applicant_two_cycles', true, 'enabled'),
  (20, 'applicant_withdrawn', true, 'enabled'),
  (21, 'applicant_no_application', true, 'enabled'),
  (22, 'member_and_applicant', true, 'enabled'),
  (23, 'stranger', true, 'enabled');
update ppl set uid = ('00000000-0000-4000-a000-0000000000' || lpad(n::text, 2, '0'))::uuid;

insert into rush.profiles (id, display_name, active)
select uid, label, active from ppl;

insert into rush.auth_identities (issuer, subject, app_user_id, disabled_at)
select 'https://harness.invalid', uid::text, uid, case when identity = 'disabled' then now() end
from ppl where identity <> 'none';

insert into harness.identities (label, db_role, claims)
select label, 'authenticated', json_build_object('iss', 'https://harness.invalid/', 'sub', uid::text, 'role', 'authenticated')::text from ppl
union all select 'ghost_sub', 'authenticated', '{"iss":"https://harness.invalid","sub":"00000000-0000-4000-a000-0000000000ff","role":"authenticated"}'
union all select 'anon', 'anon', '{"role":"anon"}';

-- Memberships (user, cycle, role, active)
create temporary table mem (label text, cycle text, role rush.member_role, active boolean default true);
insert into mem (label, cycle, role, active) values
  ('owner_all', 'c_open', 'OWNER', true), ('owner_all', 'c_lock', 'OWNER', true), ('owner_all', 'c_closed', 'OWNER', true), ('owner_all', 'c_arch', 'OWNER', true),
  ('board_open', 'c_open', 'BOARD', true), ('board_open', 'c_closed', 'MEMBER', true),
  ('panel_lock', 'c_lock', 'PANEL', true), ('panel_lock', 'c_open', 'PANEL', true),
  ('member_open', 'c_open', 'MEMBER', true),
  ('rc_open_reviewer', 'c_open', 'RECRUITMENT_COMMITTEE', true),
  ('rc_closed', 'c_closed', 'RECRUITMENT_COMMITTEE', true), ('rc_closed', 'c_closed', 'MEMBER', true), ('rc_closed', 'c_open', 'MEMBER', true),
  ('rc_draft_batch', 'c_open', 'RECRUITMENT_COMMITTEE', true),
  ('rc_panel_lock', 'c_lock', 'RECRUITMENT_COMMITTEE', true), ('rc_panel_lock', 'c_lock', 'PANEL', true),
  ('inactive_membership', 'c_open', 'BOARD', false),
  ('inactive_profile', 'c_open', 'BOARD', true),
  ('disabled_identity', 'c_open', 'OWNER', true),
  ('no_identity', 'c_open', 'OWNER', true),
  ('evaluator', 'c_open', 'MEMBER', true), ('evaluator', 'c_lock', 'MEMBER', true),
  ('panel_lock_conflict', 'c_lock', 'PANEL', true),
  ('rc_inproc_reviewer', 'c_inproc', 'RECRUITMENT_COMMITTEE', true), ('rc_inproc_reviewer', 'c_arch', 'MEMBER', true),
  ('member_and_applicant', 'c_open', 'MEMBER', true);

insert into rush.memberships (id, user_id, cycle_id, role, active, revoked_at)
select 'h-mem-' || row_number() over (), p.uid, m.cycle, m.role, m.active, case when m.active then null else now() end
from mem m join ppl p on p.label = m.label;

-- Bulk members: 60 MEMBER in c_open, of whom 10 are also PANEL in c_lock.
insert into rush.profiles (id, display_name)
select ('00000000-0000-4000-b000-' || lpad(g::text, 12, '0'))::uuid, 'Bulk member ' || g from generate_series(1, 60) g;
insert into rush.memberships (id, user_id, cycle_id, role)
select 'h-mem-bulk-open-' || g, ('00000000-0000-4000-b000-' || lpad(g::text, 12, '0'))::uuid, 'c_open', 'MEMBER' from generate_series(1, 60) g;
insert into rush.memberships (id, user_id, cycle_id, role)
select 'h-mem-bulk-lock-' || g, ('00000000-0000-4000-b000-' || lpad(g::text, 12, '0'))::uuid, 'c_lock', 'PANEL' from generate_series(1, 10) g;

-- PNMs and applications
create temporary table pn (key text primary key, owner text);
insert into pn values
  ('pnm_1', 'applicant_open_submitted'), ('pnm_2', 'applicant_open_draft'), ('pnm_3', 'applicant_lock'),
  ('pnm_4', 'applicant_two_cycles'), ('pnm_5', 'applicant_withdrawn'), ('pnm_6', 'applicant_no_application'),
  ('pnm_7', 'member_and_applicant'), ('pnm_8', null), ('pnm_9', null), ('pnm_10', null);
insert into rush.pnms (id, auth_user_id, name, contact, normalized_contact)
select key, p.uid, 'PNM ' || key, key || '@harness.invalid', key || '@harness.invalid'
from pn left join ppl p on p.label = pn.owner;

insert into rush.applications (id, pnm_id, cycle_id, status) values
  ('app_open_1', 'pnm_1', 'c_open', 'SUBMITTED'),
  ('app_open_2', 'pnm_2', 'c_open', 'DRAFT'),
  ('app_lock_1', 'pnm_3', 'c_lock', 'IN_PROCESS'),
  ('app_closed_1', 'pnm_4', 'c_closed', 'OFFERED'),
  ('app_open_5', 'pnm_4', 'c_open', 'SUBMITTED'),
  ('app_lock_2', 'pnm_5', 'c_lock', 'WITHDRAWN'),
  ('app_open_6', 'pnm_7', 'c_open', 'SUBMITTED'),
  ('app_open_7', 'pnm_8', 'c_open', 'ELIGIBLE'),
  ('app_open_3', 'pnm_9', 'c_open', 'IN_PROCESS'),
  ('app_open_4', 'pnm_10', 'c_open', 'IN_PROCESS'),
  ('app_inproc_1', 'pnm_8', 'c_inproc', 'IN_PROCESS');

-- Bulk: 300 pnms without accounts, applications spread over three cycles.
insert into rush.pnms (id, name, contact, normalized_contact)
select 'pnm_bulk_' || g, 'Bulk PNM ' || g, 'bulk' || g || '@harness.invalid', 'bulk' || g || '@harness.invalid' from generate_series(1, 300) g;
insert into rush.applications (id, pnm_id, cycle_id, status)
select 'app_bulk_' || g, 'pnm_bulk_' || g,
  case when g <= 200 then 'c_open' when g <= 260 then 'c_lock' else 'c_closed' end,
  (case when g % 7 = 0 then 'WITHDRAWN' when g <= 200 then 'SUBMITTED' else 'IN_PROCESS' end)::rush.application_status
from generate_series(1, 300) g;

-- Questions, responses, documents
insert into rush.application_questions (id, cycle_id, key, prompt, input_type) values
  ('q_open', 'c_open', 'why_mecg', 'Why MECG?', 'long_text'),
  ('q_lock', 'c_lock', 'why_mecg', 'Why MECG?', 'long_text'),
  ('q_closed', 'c_closed', 'why_mecg', 'Why MECG?', 'long_text'),
  ('q_inproc', 'c_inproc', 'why_mecg', 'Why MECG?', 'long_text');
insert into rush.application_responses (id, application_id, question_key, question_text, response_text)
select 'resp_' || a.id, a.id, 'why_mecg', 'Why MECG?', 'Because.' from rush.applications a where a.id not like 'app_bulk_%' or a.id in ('app_bulk_1', 'app_bulk_250', 'app_bulk_290');

insert into rush.application_documents (id, application_id, owner_user_id, cycle_id, kind, object_path, original_filename, declared_size, status) values
  ('doc_1', 'app_open_1', '00000000-0000-4000-a000-000000000016', 'c_open', 'RESUME', '00000000-0000-4000-a000-000000000016/c_open/00000000-0000-4000-d000-000000000001.pdf', 'r.pdf', 100, 'ATTACHED'),
  ('doc_2', 'app_open_5', '00000000-0000-4000-a000-000000000019', 'c_open', 'RESUME', '00000000-0000-4000-a000-000000000019/c_open/00000000-0000-4000-d000-000000000002.pdf', 'r.pdf', 100, 'ATTACHED'),
  ('doc_3', null, '00000000-0000-4000-a000-000000000017', 'c_open', 'RESUME', '00000000-0000-4000-a000-000000000017/c_open/00000000-0000-4000-d000-000000000003.pdf', 'r.pdf', 100, 'ATTACHED'),
  ('doc_4', 'app_open_1', '00000000-0000-4000-a000-000000000016', 'c_open', 'RESUME', '00000000-0000-4000-a000-000000000016/c_open/00000000-0000-4000-d000-000000000004.pdf', 'r.pdf', 100, 'READY'),
  ('doc_5', 'app_lock_1', '00000000-0000-4000-a000-000000000018', 'c_lock', 'RESUME', '00000000-0000-4000-a000-000000000018/c_lock/00000000-0000-4000-d000-000000000005.pdf', 'r.pdf', 100, 'ATTACHED'),
  ('doc_6', 'app_closed_1', '00000000-0000-4000-a000-000000000019', 'c_closed', 'RESUME', '00000000-0000-4000-a000-000000000019/c_closed/00000000-0000-4000-d000-000000000006.pdf', 'r.pdf', 100, 'ATTACHED'),
  ('doc_7', 'app_inproc_1', '00000000-0000-4000-a000-000000000023', 'c_inproc', 'RESUME', '00000000-0000-4000-a000-000000000023/c_inproc/00000000-0000-4000-d000-000000000007.pdf', 'r.pdf', 100, 'ATTACHED'),
  ('doc_8', 'app_open_4', '00000000-0000-4000-a000-000000000016', 'c_open', 'RESUME', '00000000-0000-4000-a000-000000000016/c_open/00000000-0000-4000-d000-000000000008.pdf', 'r.pdf', 100, 'REJECTED');

-- Rounds, rubrics, criteria
insert into rush.rounds (id, cycle_id, kind, name, status, weight) values
  ('r_open_1', 'c_open', 'SPEED_DATING', 'Open round 1', 'ACTIVE', 50),
  ('r_open_2', 'c_open', 'GROUP_CASE', 'Open round 2', 'DRAFT', 50),
  ('r_lock_1', 'c_lock', 'SPEED_DATING', 'Lock round', 'FROZEN', 100),
  ('r_closed_1', 'c_closed', 'SPEED_DATING', 'Closed round', 'FINALIZED', 100),
  ('r_inproc_1', 'c_inproc', 'SPEED_DATING', 'In process round', 'ACTIVE', 100);
insert into rush.rubrics (id, round_id, version, minimum_observed_criteria)
select 'rub_' || id, id, 1, 1 from rush.rounds where id like 'r_%';
insert into rush.rubric_criteria (id, rubric_id, key, name, weight, required, position)
select 'crit_' || id, id, 'overall', 'Overall', 100, true, 0 from rush.rubrics where id like 'rub_%';

-- Screening batches (one per cycle) and reviewers
insert into rush.screening_batches (id, cycle_id, rubric_id, status, created_by) values
  ('sb_open', 'c_open', 'rub_r_open_1', 'PUBLISHED', '00000000-0000-4000-a000-000000000001'),
  ('sb_lock', 'c_lock', 'rub_r_lock_1', 'PUBLISHED', '00000000-0000-4000-a000-000000000001'),
  ('sb_inproc', 'c_inproc', 'rub_r_inproc_1', 'PUBLISHED', '00000000-0000-4000-a000-000000000001'),
  ('sb_closed', 'c_closed', 'rub_r_closed_1', 'DRAFT', '00000000-0000-4000-a000-000000000001'),
  ('sb_arch', 'c_arch', 'rub_r_closed_1', 'FROZEN', '00000000-0000-4000-a000-000000000001');
insert into rush.screening_reviewers (batch_id, reviewer_id, active) values
  ('sb_open', '00000000-0000-4000-a000-000000000005', true),
  ('sb_open', '00000000-0000-4000-a000-000000000002', false),
  ('sb_open', '00000000-0000-4000-a000-000000000007', false),
  ('sb_lock', '00000000-0000-4000-a000-000000000008', true),
  ('sb_inproc', '00000000-0000-4000-a000-000000000015', true),
  ('sb_closed', '00000000-0000-4000-a000-000000000006', true),
  ('sb_arch', '00000000-0000-4000-a000-000000000015', true);

-- Evaluation assignments, evaluations, ratings
insert into rush.evaluation_assignments (id, round_id, application_id, evaluator_id, status) values
  ('ea_1', 'r_open_1', 'app_open_1', '00000000-0000-4000-a000-000000000013', 'ASSIGNED'),
  ('ea_2', 'r_open_1', 'app_open_3', '00000000-0000-4000-a000-000000000013', 'RECUSED'),
  ('ea_3', 'r_lock_1', 'app_lock_1', '00000000-0000-4000-a000-000000000013', 'LOCKED'),
  ('ea_4', 'r_lock_1', 'app_lock_2', '00000000-0000-4000-a000-000000000003', 'LOCKED'),
  ('ea_5', 'r_open_1', 'app_open_2', '00000000-0000-4000-a000-000000000005', 'ASSIGNED'),
  ('ea_6', 'r_inproc_1', 'app_inproc_1', '00000000-0000-4000-a000-000000000015', 'ASSIGNED'),
  ('ea_7', 'r_open_1', 'app_open_5', '00000000-0000-4000-a000-000000000022', 'ASSIGNED'),
  ('ea_8', 'r_lock_1', 'app_lock_1', '00000000-0000-4000-a000-000000000014', 'LOCKED');
insert into rush.evaluation_assignments (id, round_id, application_id, evaluator_id, status)
select 'ea_bulk_' || a || '_' || e, 'r_open_1', 'app_bulk_' || a, ('00000000-0000-4000-b000-' || lpad(e::text, 12, '0'))::uuid,
  (case when (a + e) % 11 = 0 then 'RECUSED' when e <= 3 then 'LOCKED' else 'ASSIGNED' end)::rush.assignment_status
from generate_series(1, 200) a, generate_series(1, 10) e;

insert into rush.evaluations (id, assignment_id, evaluator_id, rubric_id, status) values
  ('ev_1', 'ea_1', '00000000-0000-4000-a000-000000000013', 'rub_r_open_1', 'LOCKED'),
  ('ev_3', 'ea_3', '00000000-0000-4000-a000-000000000013', 'rub_r_lock_1', 'DRAFT'),
  ('ev_4', 'ea_4', '00000000-0000-4000-a000-000000000003', 'rub_r_lock_1', 'LOCKED'),
  ('ev_8', 'ea_8', '00000000-0000-4000-a000-000000000014', 'rub_r_lock_1', 'LOCKED'),
  ('ev_6', 'ea_6', '00000000-0000-4000-a000-000000000015', 'rub_r_inproc_1', 'LOCKED');
insert into rush.evaluations (id, assignment_id, evaluator_id, rubric_id, status)
select 'ev_bulk_' || a || '_' || e, 'ea_bulk_' || a || '_' || e, ('00000000-0000-4000-b000-' || lpad(e::text, 12, '0'))::uuid, 'rub_r_open_1',
  (case when e = 1 then 'DRAFT' else 'LOCKED' end)::rush.evaluation_status
from generate_series(1, 200) a, generate_series(1, 3) e;
insert into rush.criterion_ratings (id, evaluation_id, criterion_id, score)
select 'cr_' || id, id, 'crit_' || rubric_id, 3 from rush.evaluations;

insert into rush.round_participations (id, round_id, application_id, rubric_id, required_evaluators, assignment_policy, advanced_by) values
  ('rp_1', 'r_open_1', 'app_open_1', 'rub_r_open_1', 2, '{}', '00000000-0000-4000-a000-000000000001'),
  ('rp_2', 'r_open_1', 'app_open_3', 'rub_r_open_1', 2, '{}', '00000000-0000-4000-a000-000000000001'),
  ('rp_3', 'r_lock_1', 'app_lock_1', 'rub_r_lock_1', 2, '{}', '00000000-0000-4000-a000-000000000001'),
  ('rp_4', 'r_lock_1', 'app_lock_2', 'rub_r_lock_1', 2, '{}', '00000000-0000-4000-a000-000000000001'),
  ('rp_5', 'r_inproc_1', 'app_inproc_1', 'rub_r_inproc_1', 2, '{}', '00000000-0000-4000-a000-000000000001'),
  ('rp_6', 'r_open_1', 'app_open_5', 'rub_r_open_1', 2, '{}', '00000000-0000-4000-a000-000000000001');

insert into rush.round_calibration_acknowledgements (round_id, rubric_id, evaluator_id)
select distinct ea.round_id, 'rub_' || ea.round_id, ea.evaluator_id from rush.evaluation_assignments ea
on conflict do nothing;

-- Conflicts
insert into rush.conflict_declarations (id, application_id, declarer_id, reason) values
  ('cd_1', 'app_open_4', '00000000-0000-4000-a000-000000000013', 'roommate'),
  ('cd_2', 'app_open_2', '00000000-0000-4000-a000-000000000007', 'relative'),
  ('cd_3', 'app_lock_1', '00000000-0000-4000-a000-000000000014', 'friend'),
  ('cd_4', 'app_closed_1', '00000000-0000-4000-a000-000000000001', 'relative'),
  ('cd_5', 'app_bulk_5', '00000000-0000-4000-a000-000000000002', 'teammate');

-- Decisions
insert into rush.decisions (id, cycle_id, application_id, outcome, status, reason, created_by_id) values
  ('dec_1', 'c_lock', 'app_lock_1', 'OFFER', 'PENDING', 'strong', '00000000-0000-4000-a000-000000000003'),
  ('dec_2', 'c_lock', 'app_lock_2', 'REJECT', 'LOCKED', 'withdrew', '00000000-0000-4000-a000-000000000003'),
  ('dec_3', 'c_closed', 'app_closed_1', 'OFFER', 'RELEASED', 'strong', '00000000-0000-4000-a000-000000000001'),
  ('dec_4', 'c_lock', 'app_bulk_210', 'WAITLIST', 'RELEASED', 'ok', '00000000-0000-4000-a000-000000000003');
insert into rush.decision_approvals (id, decision_id, approver_id) values
  ('da_1', 'dec_1', '00000000-0000-4000-a000-000000000003'),
  ('da_2', 'dec_3', '00000000-0000-4000-a000-000000000001');

-- Events, slots, rsvps, checkins, impressions
insert into rush.events (id, cycle_id, name, kind, status, visibility, starts_at, ends_at, checkin_opens_at, checkin_closes_at, checkin_token_digest) values
  ('evt_open', 'c_open', 'Open info session', 'GENERAL', 'PUBLISHED', 'PUBLIC', now(), now() + interval '2 hours', now() - interval '1 hour', now() + interval '3 hours', repeat('1', 64)),
  ('evt_lock', 'c_lock', 'Lock social', 'GENERAL', 'PUBLISHED', 'INVITE', now(), now() + interval '2 hours', now() - interval '1 hour', now() + interval '3 hours', repeat('2', 64)),
  ('evt_closed', 'c_closed', 'Closed event', 'GENERAL', 'CLOSED', 'INTERNAL', now(), now() + interval '2 hours', now() - interval '1 hour', now() + interval '3 hours', repeat('3', 64)),
  ('evt_inproc', 'c_inproc', 'In process event', 'GENERAL', 'PUBLISHED', 'PUBLIC', now(), now() + interval '2 hours', now() - interval '1 hour', now() + interval '3 hours', repeat('4', 64)),
  ('evt_nocycle', null, 'Orphan event', 'GENERAL', 'DRAFT', 'INTERNAL', now(), now() + interval '2 hours', now() - interval '1 hour', now() + interval '3 hours', repeat('5', 64));
insert into rush.event_slots (id, event_id, starts_at, ends_at, capacity)
select 'slot_' || id, id, now(), now() + interval '30 minutes', 8 from rush.events;
insert into rush.slot_rsvps (id, slot_id, application_id) values
  ('rsvp_1', 'slot_evt_open', 'app_open_1'), ('rsvp_2', 'slot_evt_open', 'app_open_2'), ('rsvp_3', 'slot_evt_lock', 'app_lock_1'),
  ('rsvp_4', 'slot_evt_closed', 'app_closed_1'), ('rsvp_5', 'slot_evt_nocycle', 'app_open_5');
insert into rush.checkins (id, pnm_id, event_id, checkin_method, checked_in_by, reason_code) values
  ('ck_1', 'pnm_1', 'evt_open', 'SELF_SERVICE', null, null),
  ('ck_2', 'pnm_4', 'evt_open', 'STAFF_ASSISTED', '00000000-0000-4000-a000-000000000002', 'NO_CAMERA'),
  ('ck_3', 'pnm_3', 'evt_lock', 'SELF_SERVICE', null, null),
  ('ck_4', 'pnm_4', 'evt_closed', 'SELF_SERVICE', null, null),
  ('ck_5', 'pnm_8', 'evt_nocycle', 'SELF_SERVICE', null, null),
  ('ck_6', 'pnm_8', 'evt_inproc', 'SELF_SERVICE', null, null);
insert into rush.checkins (id, pnm_id, event_id, checkin_method)
select 'ck_bulk_' || g, 'pnm_bulk_' || g, 'evt_open', 'SELF_SERVICE' from generate_series(1, 150) g;
insert into rush.member_checkins (id, member_id, event_id) values
  ('mck_1', '00000000-0000-4000-a000-000000000013', 'evt_open'),
  ('mck_2', '00000000-0000-4000-a000-000000000004', 'evt_lock'),
  ('mck_3', '00000000-0000-4000-a000-000000000023', 'evt_nocycle'),
  ('mck_4', '00000000-0000-4000-a000-000000000015', 'evt_inproc');
insert into rush.event_impressions (id, event_id, application_id, member_id, score, legacy_numeric, note) values
  ('imp_1', 'evt_open', 'app_open_1', '00000000-0000-4000-a000-000000000013', null, false, 'good'),
  ('imp_2', 'evt_open', 'app_open_2', '00000000-0000-4000-a000-000000000004', null, false, 'fine'),
  ('imp_3', 'evt_lock', 'app_lock_1', '00000000-0000-4000-a000-000000000003', null, false, 'ok'),
  ('imp_4', 'evt_nocycle', 'app_open_5', '00000000-0000-4000-a000-000000000023', null, false, 'orphan');

-- Buddy slots and bookings
insert into rush.buddy_slots (id, cycle_id, member_id, starts_at, ends_at) values
  ('bs_1', 'c_open', '00000000-0000-4000-a000-000000000013', now(), now() + interval '20 minutes'),
  ('bs_2', 'c_open', '00000000-0000-4000-a000-000000000002', now(), now() + interval '20 minutes'),
  ('bs_3', 'c_lock', '00000000-0000-4000-a000-000000000003', now(), now() + interval '20 minutes'),
  ('bs_4', 'c_closed', '00000000-0000-4000-a000-000000000001', now(), now() + interval '20 minutes'),
  ('bs_5', 'c_open', '00000000-0000-4000-a000-000000000023', now(), now() + interval '20 minutes');
insert into rush.buddy_bookings (id, slot_id, application_id) values
  ('bb_1', 'bs_1', 'app_open_1'), ('bb_2', 'bs_2', 'app_open_2'), ('bb_3', 'bs_3', 'app_lock_1'), ('bb_4', 'bs_4', 'app_closed_1'), ('bb_5', 'bs_5', 'app_open_5');

-- Case groups
insert into rush.case_groups (id, cycle_id, name) values
  ('cg_open', 'c_open', 'Open group'), ('cg_lock', 'c_lock', 'Lock group'), ('cg_closed', 'c_closed', 'Closed group'), ('cg_inproc', 'c_inproc', 'In process group');
insert into rush.case_group_members (group_id, application_id) values
  ('cg_open', 'app_open_1'), ('cg_open', 'app_open_2'), ('cg_lock', 'app_lock_1'), ('cg_closed', 'app_closed_1'), ('cg_inproc', 'app_inproc_1'), ('cg_open', 'app_open_6');

-- Audit, outbox, messages, receipts
insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id) values
  ('00000000-0000-4000-a000-000000000001', 'c_open', 'APPLICATION_STATUS_SET', 'Application', 'app_open_1'),
  ('00000000-0000-4000-a000-000000000001', 'c_open', 'DECISION_CREATED', 'Decision', 'dec_x'),
  ('00000000-0000-4000-a000-000000000001', 'c_lock', 'DECISION_CREATED', 'Decision', 'dec_1'),
  ('00000000-0000-4000-a000-000000000001', 'c_closed', 'EVENT_CREATED', 'Event', 'evt_closed'),
  ('00000000-0000-4000-a000-000000000001', 'c_inproc', 'EVENT_CREATED', 'Event', 'evt_inproc'),
  ('00000000-0000-4000-a000-000000000001', 'c_inproc', 'MEMBERSHIP_GRANTED', 'Membership', 'h-mem-1'),
  ('00000000-0000-4000-a000-000000000001', null, 'CYCLE_CREATED', 'Cycle', 'c_open');
insert into rush.notification_outbox (id, cycle_id, application_id, recipient, template_key, idempotency_key) values
  ('nb_1', 'c_open', 'app_open_1', 'pnm_1@harness.invalid', 'APPLICATION_RECEIVED', 'idem-00000001'),
  ('nb_2', 'c_lock', 'app_lock_1', 'pnm_3@harness.invalid', 'APPLICATION_RECEIVED', 'idem-00000002'),
  ('nb_3', 'c_closed', 'app_closed_1', 'pnm_4@harness.invalid', 'APPLICATION_RECEIVED', 'idem-00000003'),
  ('nb_4', 'c_inproc', 'app_inproc_1', 'pnm_8@harness.invalid', 'APPLICATION_RECEIVED', 'idem-00000004');
insert into rush.messages (id, cycle_id, application_id, recipient, subject, kind) values
  ('msg_1', 'c_open', 'app_open_1', 'pnm_1@harness.invalid', 'Received', 'RECEIPT'),
  ('msg_2', 'c_open', 'app_open_5', 'pnm_4@harness.invalid', 'Received', 'RECEIPT'),
  ('msg_3', 'c_lock', 'app_lock_1', 'pnm_3@harness.invalid', 'Update', 'UPDATE'),
  ('msg_4', null, null, 'nobody@harness.invalid', 'Orphan', 'SYSTEM'),
  ('msg_5', 'c_closed', 'app_closed_1', 'pnm_4@harness.invalid', 'Offer', 'DECISION'),
  ('msg_6', null, 'app_open_6', 'pnm_7@harness.invalid', 'No cycle', 'RECEIPT');
insert into rush.mutation_receipts (actor_id, mutation_key, operation, result) values
  ('00000000-0000-4000-a000-000000000013', 'mut-00000001', 'submit_evaluation', '{}'),
  ('00000000-0000-4000-a000-000000000016', 'mut-00000002', 'submit_application', '{}'),
  ('00000000-0000-4000-a000-000000000001', 'mut-00000003', 'create_cycle', '{}');

-- Member-side tables
insert into rush.hash_votes (id, cycle_id, application_id, voter_id, vote, stage) values
  ('hv_1', 'c_open', 'app_open_1', '00000000-0000-4000-a000-000000000013', 'YES', 'APPLICATION'),
  ('hv_2', 'c_open', 'app_open_2', '00000000-0000-4000-a000-000000000002', 'NO', 'APPLICATION'),
  ('hv_3', 'c_lock', 'app_lock_1', '00000000-0000-4000-a000-000000000003', 'UNSURE', 'FINAL');
insert into rush.referrals (id, cycle_id, referrer_id, name, email, normalized_email, reason) values
  ('ref_1', 'c_open', '00000000-0000-4000-a000-000000000013', 'Friend A', 'a@x.io', 'a@x.io', 'sharp'),
  ('ref_2', 'c_open', '00000000-0000-4000-a000-000000000023', 'Friend B', 'b@x.io', 'b@x.io', 'sharp'),
  ('ref_3', 'c_lock', '00000000-0000-4000-a000-000000000004', 'Friend C', 'c@x.io', 'c@x.io', 'sharp'),
  ('ref_4', 'c_inproc', '00000000-0000-4000-a000-000000000015', 'Friend D', 'd@x.io', 'd@x.io', 'sharp');
insert into rush.interest_signups (id, cycle_id, name, email) values
  ('is_1', 'c_open', 'Interested A', 'ia@x.io'), ('is_2', 'c_lock', 'Interested B', 'ib@x.io'), ('is_3', 'c_closed', 'Interested C', 'ic@x.io');
insert into rush.process_surveys (id, cycle_id, rating) values
  ('ps_1', 'c_open', 4), ('ps_2', 'c_lock', 3), ('ps_3', 'c_closed', 5);
insert into rush.provisioning_incidents (id, cycle_id, requested_by, email, phase, clerk_cleanup_failed, profile_cleanup_failed) values
  ('00000000-0000-4000-c000-000000000001', 'c_open', '00000000-0000-4000-a000-000000000001', 'x@y.io', 'CREATE_ACCOUNT', false, false),
  ('00000000-0000-4000-c000-000000000002', 'c_lock', '00000000-0000-4000-a000-000000000001', 'x@y.io', 'IDENTITY_LINK', false, false),
  ('00000000-0000-4000-c000-000000000003', 'c_closed', '00000000-0000-4000-a000-000000000001', 'x@y.io', 'MEMBERSHIP_GRANT', true, false);
insert into rush.projects (id, slug, title) values ('proj_1', 'proj-one', 'Project one'), ('proj_2', 'proj-two', 'Project two');
insert into rush.project_members (project_id, user_id, role_label) values
  ('proj_1', '00000000-0000-4000-a000-000000000013', 'Lead'), ('proj_2', '00000000-0000-4000-a000-000000000004', 'Analyst');

-- Branches an independent review found were never decisive above.
-- A colleague only in a CLOSED cycle: rc_closed (RC there) must not see them, owner_all must.
insert into rush.profiles (id, display_name) values ('00000000-0000-4000-e000-000000000001', 'Closed-cycle-only member');
insert into rush.memberships (id, user_id, cycle_id, role) values ('h-mem-closed-only', '00000000-0000-4000-e000-000000000001', 'c_closed', 'MEMBER');
-- An ineligible active reviewer on a PUBLISHED batch: evaluator keeps seeing their assignment.
insert into rush.screening_reviewers (batch_id, reviewer_id, active) values ('sb_open', '00000000-0000-4000-a000-000000000013', true);
-- An RC reviewing a DRAFT batch in a DRAFT cycle, also RC in an ARCHIVED cycle, with applications in both.
insert into rush.profiles (id, display_name) values ('00000000-0000-4000-e000-000000000002', 'rc_draft_cycle');
insert into rush.auth_identities (issuer, subject, app_user_id) values ('https://harness.invalid', '00000000-0000-4000-e000-000000000002', '00000000-0000-4000-e000-000000000002');
insert into harness.identities (label, db_role, claims) values ('rc_draft_cycle', 'authenticated', '{"iss":"https://harness.invalid/","sub":"00000000-0000-4000-e000-000000000002","role":"authenticated"}');
insert into rush.memberships (id, user_id, cycle_id, role) values
  ('h-mem-rc-draft', '00000000-0000-4000-e000-000000000002', 'c_draft', 'RECRUITMENT_COMMITTEE'),
  ('h-mem-rc-arch', '00000000-0000-4000-e000-000000000002', 'c_arch', 'RECRUITMENT_COMMITTEE');
insert into rush.pnms (id, name, contact, normalized_contact) values
  ('pnm_draft', 'PNM draft', 'draft@harness.invalid', 'draft@harness.invalid'),
  ('pnm_arch', 'PNM arch', 'arch@harness.invalid', 'arch@harness.invalid');
insert into rush.applications (id, pnm_id, cycle_id, status) values
  ('app_draft_1', 'pnm_draft', 'c_draft', 'SUBMITTED'),
  ('app_arch_1', 'pnm_arch', 'c_arch', 'OFFERED');
insert into rush.screening_batches (id, cycle_id, rubric_id, status, created_by) values
  ('sb_draft', 'c_draft', 'rub_r_open_1', 'DRAFT', '00000000-0000-4000-a000-000000000001');
insert into rush.screening_reviewers (batch_id, reviewer_id, active) values ('sb_draft', '00000000-0000-4000-e000-000000000002', true);
-- An applicant who declared a conflict on their own application.
insert into rush.conflict_declarations (id, application_id, declarer_id, reason) values
  ('cd_self', 'app_open_1', '00000000-0000-4000-a000-000000000016', 'self');

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'rush' loop
    execute format('analyze rush.%I', t);
  end loop;
end $$;
