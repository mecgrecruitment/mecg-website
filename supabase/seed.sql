-- LOCAL DEV SEED ONLY — runs on `supabase db reset`. Never apply to a hosted
-- project: it inserts auth.users rows directly and uses placeholder emails.
--
-- ⚠ CON-8 blocker: the 10 board emails below are PLACEHOLDERS synthesized from
-- names in src/lib/internal-data.ts. Replace with the club's real roster before
-- any real auth go-live.

-- ── 1. Invite allowlist (gate for the auth.users inserts below) ──────────────
insert into public.invite_allowlist (email, role, notes) values
  ('annie.callam@umich.edu',      'board', 'PLACEHOLDER EMAIL — replace per CON-8 · President'),
  ('nandini.tatiwala@umich.edu',  'board', 'PLACEHOLDER EMAIL — replace per CON-8 · VP External'),
  ('abby.osterhart@umich.edu',    'board', 'PLACEHOLDER EMAIL — replace per CON-8 · VP Internal'),
  ('jandy.arias@umich.edu',       'board', 'PLACEHOLDER EMAIL — replace per CON-8 · VP Recruitment'),
  ('blake.stark@umich.edu',       'board', 'PLACEHOLDER EMAIL — replace per CON-8 · VP Consulting'),
  ('sumedha.katti@umich.edu',     'board', 'PLACEHOLDER EMAIL — replace per CON-8 · VP Consulting'),
  ('maya.menon@umich.edu',        'board', 'PLACEHOLDER EMAIL — replace per CON-8 · VP Education'),
  ('luciano.delcarpio@umich.edu', 'board', 'PLACEHOLDER EMAIL — replace per CON-8 · VP Education'),
  ('selena.cooper@umich.edu',     'board', 'PLACEHOLDER EMAIL — replace per CON-8 · VP Finance'),
  ('angela.yang@umich.edu',       'board', 'PLACEHOLDER EMAIL — replace per CON-8 · VP Marketing'),
  ('committee.test@umich.edu',    'recruitment_committee', 'Local test account'),
  ('member.test@umich.edu',       'general_member',        'Local test account');

-- ── 2. Auth users (password: password123) ────────────────────────────────────
-- Direct GoTrue-shaped inserts; the signup-gate trigger passes because the
-- allowlist exists. The AFTER INSERT trigger now creates a *pending*
-- membership_requests row per allowlist match (board approval required —
-- see migration 12) and consumes each allowlist entry; section 3 below
-- grants these seeded accounts member access directly instead, since seed
-- data represents already-approved members, not a pending queue.
-- Token columns are empty strings, not NULL — GoTrue scans crash on NULLs.
with new_users (email, full_name) as (
  values
    ('annie.callam@umich.edu',      'Annie Callam'),
    ('nandini.tatiwala@umich.edu',  'Nandini Tatiwala'),
    ('abby.osterhart@umich.edu',    'Abby Osterhart'),
    ('jandy.arias@umich.edu',       'Jandy Arias'),
    ('blake.stark@umich.edu',       'Blake Stark'),
    ('sumedha.katti@umich.edu',     'Sumedha Katti'),
    ('maya.menon@umich.edu',        'Maya Menon'),
    ('luciano.delcarpio@umich.edu', 'Luciano del Carpio'),
    ('selena.cooper@umich.edu',     'Selena Cooper'),
    ('angela.yang@umich.edu',       'Angela Yang'),
    ('committee.test@umich.edu',    'Committee Test'),
    ('member.test@umich.edu',       'Member Test')
)
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
select
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  u.email,
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name),
  now(),
  now(),
  '', '', '', '', '', '', '', ''
from new_users u;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  au.id,
  au.id::text,
  'email',
  jsonb_build_object('sub', au.id::text, 'email', au.email, 'email_verified', true),
  now(),
  now(),
  now()
from auth.users au;

-- ── 3. Grant seeded/test accounts member access directly ────────────────────
-- Local seed data already bypasses normal signup (direct auth.users insert
-- above); do the same for member grant instead of relying on the signup
-- trigger, which now only creates a pending membership_requests row (see
-- migration 12). These accounts represent already-approved members, so grant
-- membership directly and drop the trigger's pending rows for them.
insert into public.members (user_id, email, full_name, role)
select au.id, au.email, au.raw_user_meta_data ->> 'full_name', ia.role
from auth.users au
join public.invite_allowlist ia on lower(ia.email) = lower(au.email);

delete from public.membership_requests mr
using public.invite_allowlist ia
where lower(mr.email) = lower(ia.email);

-- Board members are already public on the site.
update public.members
   set is_public = true
 where role = 'board';

-- ── 4. Fall 2026 cycle ───────────────────────────────────────────────────────
insert into public.recruitment_cycles (name, is_active, is_open_rush, created_by)
select 'Fall 2026', true, false, m.id
from public.members m
where m.email = 'annie.callam@umich.edu';

-- ── 5. Application questions (prompts from the current /apply form) ──────────
insert into public.application_questions (cycle_id, key, prompt, input_type, required, sort_order)
select rc.id, q.key, q.prompt, 'long_text', q.required, q.sort_order
from public.recruitment_cycles rc,
  (values
    ('why_mecg',        'Why do you want to join MECG?',                 true,  1),
    ('teamwork',        'Tell us about a time you worked on a team.',    true,  2),
    ('problem_solving', 'Describe a problem you broke down and solved.', true,  3),
    ('anything_else',   'Anything else you want us to know?',            false, 4)
  ) as q (key, prompt, required, sort_order)
where rc.name = 'Fall 2026';

-- ── 6. Rubric v1 for the application stage (placeholder criteria; real
--       criteria/weights come from the club's Google Docs — blocks Track B4) ──
insert into public.rubric_versions (cycle_id, stage, version_number, label, is_active, created_by)
select rc.id, 'applied', 1, 'Fall 2026 Application v1 (placeholder)', true, m.id
from public.recruitment_cycles rc
join public.members m on m.email = 'annie.callam@umich.edu'
where rc.name = 'Fall 2026';

insert into public.rubric_criteria (rubric_version_id, name, description, weight, display_order)
select rv.id, c.name, c.description, 1.0, c.display_order
from public.rubric_versions rv,
  (values
    ('Communication',    'Clear, concise, structured responses.',             1),
    ('Problem Solving',  'Breaks ambiguous problems into logical parts.',     2),
    ('Collaboration',    'Listens, builds on ideas, and supports teammates.', 3),
    ('Interest in MECG', 'Shows genuine motivation and preparation.',         4)
  ) as c (name, description, display_order)
where rv.label = 'Fall 2026 Application v1 (placeholder)';

-- ── 7. Synthetic candidates (per_cycle_seq assigned by trigger → C01…C04) ────
insert into public.candidates (cycle_id, full_name, year, major, email, per_cycle_seq)
select rc.id, c.full_name, c.year, c.major, c.email, 0 -- seq overwritten by trigger
from public.recruitment_cycles rc,
  (values
    ('Maya Shah',      '2027', 'Industrial Operations Engineering', 'maya.candidate@umich.edu'),
    ('Ethan Lee',      '2028', 'Computer Science',                  'ethan.candidate@umich.edu'),
    ('Sofia Martinez', '2027', 'Business',                          'sofia.candidate@umich.edu'),
    ('Noah Patel',     '2026', 'Mechanical Engineering',            'noah.candidate@umich.edu')
  ) as c (full_name, year, major, email)
where rc.name = 'Fall 2026';

-- ── 8. Rubrics for the live evaluation stages (mirror the application rubric;
--       placeholder criteria until the club supplies real ones). One active v1
--       per stage so submitCandidateScore has criteria to write against. ──────
insert into public.rubric_versions (cycle_id, stage, version_number, label, is_active, created_by)
select rc.id, s.stage::public.candidate_stage, 1,
       'Fall 2026 ' || s.stage || ' v1 (placeholder)', true, m.id
from public.recruitment_cycles rc
join public.members m on m.email = 'annie.callam@umich.edu'
cross join (values ('speed_dating'), ('group_case'), ('interview')) as s (stage)
where rc.name = 'Fall 2026';

insert into public.rubric_criteria (rubric_version_id, name, description, weight, display_order)
select rv.id, c.name, c.description, 1.0, c.display_order
from public.rubric_versions rv
join public.recruitment_cycles rc on rc.id = rv.cycle_id and rc.name = 'Fall 2026'
cross join (values
    ('Communication',   'Clear, concise, structured responses.',            1),
    ('Problem Solving', 'Breaks ambiguous problems into logical parts.',     2),
    ('Collaboration',   'Listens, builds on ideas, and supports teammates.', 3),
    ('Overall Fit',     'Would strengthen the team and the cohort.',         4)
  ) as c (name, description, display_order)
where rv.stage in ('speed_dating', 'group_case', 'interview')
  and rv.version_number = 1;

-- ── 9. Open-rush events with attendance phrases (applicant check-in demo). ───
insert into public.recruitment_events (cycle_id, title, event_type, event_date, location, attendance_code, is_active)
select rc.id, e.title, 'open_rush'::public.event_type,
       now() + e.offset_days * interval '1 day', e.location, e.code, true
from public.recruitment_cycles rc
cross join (values
    ('Fall Kickoff Info Session', 'Ross B0560', 'GOBLUE',  2),
    ('Coffee Chat & Casework',    'Ross R0210', 'CASEUP',  5),
    ('Meet the Members Mixer',    'The Union',  'MECGMIX', 9)
  ) as e (title, location, code, offset_days)
where rc.name = 'Fall 2026';
