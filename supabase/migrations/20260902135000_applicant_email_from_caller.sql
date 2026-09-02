-- The applicant's email has to come from the profile, not from the JWT.
--
-- save_application_draft created the applicant's rush.pnms row with
-- coalesce(auth.jwt() ->> 'email', 'pending@invalid'). Clerk's Supabase session
-- token carries iss/sub/sid/azp/role and no email claim (that is exactly why
-- resolveCurrentIdentity fetches the primary address from the Clerk API), so
-- every applicant fell through to the placeholder. rush.pnms.normalized_contact
-- is `not null unique`: the first applicant took 'pending@invalid' and every
-- applicant after them got a unique-violation 500 from /api/apply/draft. No
-- draft row means begin_resume_upload refuses the resume, which means
-- submit_application refuses the application. One placeholder in a unique
-- column closed the portal for everyone but the first person through it.
--
-- rush.profiles.primary_email already holds the verified address:
-- ensure_external_identity writes it from Clerk's verified primary on every
-- sign-in, and rush.actor_id() resolves the caller to exactly that profile. So
-- the email is read here, server-side, and is never anything a caller passes
-- in. The signature is unchanged and there is no placeholder fallback: a
-- fallback literal in a unique column is the bug.
--
-- Body reproduced from 20260830100000 with auth.uid() already rewritten to
-- rush.actor_id() by 20260902090000. Every validation, the cycle gate and the
-- on-conflict upsert are unchanged; only the email source moved.
create or replace function rush.save_application_draft(payload jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare
  actor uuid := rush.actor_id();
  v_cycle_id text;
  person_id text;
  application_id text;
  draft_answers jsonb := coalesce(payload->'answers','{}'::jsonb);
  actor_email text;
  normalized_email text;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select p.primary_email into actor_email from rush.profiles p where p.id=actor;
  normalized_email := lower(trim(coalesce(actor_email,'')));
  if char_length(normalized_email) not between 3 and 254 or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'a verified email is required' using errcode='22023'; end if;
  if jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 65536 or jsonb_typeof(draft_answers) <> 'object' or (select count(*) from jsonb_object_keys(draft_answers)) > 50 then raise exception 'invalid draft' using errcode='22023'; end if;
  if exists (select 1 from jsonb_each(draft_answers) x where char_length(x.key)>80 or x.key !~ '^[a-z][a-z0-9_]*$' or jsonb_typeof(x.value)<>'string') then raise exception 'invalid draft answers' using errcode='22023'; end if;
  if exists (select 1 from jsonb_each_text(draft_answers) x where char_length(x.value)>8000)
    or (select coalesce(sum(char_length(x.value)),0) from jsonb_each_text(draft_answers) x)>40000 then raise exception 'draft answers too long' using errcode='22023'; end if;
  select c.id into v_cycle_id from rush.rush_cycles c
  where c.status='OPEN' and (c.opens_at is null or c.opens_at<=now()) and (c.closes_at is null or c.closes_at>=now())
  order by c.created_at desc limit 1;
  if v_cycle_id is null then raise exception 'applications are not open' using errcode='55000'; end if;
  select p.id into person_id from rush.pnms p where p.auth_user_id=actor;
  if person_id is null then
    -- Mirrors submit_application: a contact already held by another account is a
    -- reportable conflict, not a raw constraint violation.
    if exists (select 1 from rush.pnms p where p.normalized_contact=normalized_email and p.auth_user_id is distinct from actor) then raise exception 'contact belongs to another account' using errcode='23505'; end if;
    insert into rush.pnms (auth_user_id,name,contact,normalized_contact)
    values (actor,coalesce(nullif(trim(payload->>'name'),''),'Applicant'),trim(actor_email),normalized_email)
    returning id into person_id;
  end if;
  -- Deliberately no update of contact/normalized_contact on the existing-row
  -- path. A changed Clerk address must not be able to walk into another
  -- applicant's unique contact from a draft save. submit_application already
  -- owns that reconciliation and guards it.
  insert into rush.applications (pnm_id,cycle_id,status,draft_payload) values (person_id,v_cycle_id,'DRAFT',payload)
  on conflict (pnm_id,cycle_id) do update set draft_payload=excluded.draft_payload
  where rush.applications.status in ('DRAFT','NEEDS_INFO') returning id into application_id;
  if application_id is null then raise exception 'application can no longer be edited' using errcode='55000'; end if;
  return application_id;
end; $$;

-- Unchanged signature, so the grants from 20260830100000 survive the replace.
-- Restated because a silently ungranted applicant RPC is a closed portal.
revoke all on function rush.save_application_draft(jsonb) from public, anon;
grant execute on function rush.save_application_draft(jsonb) to authenticated, service_role;
