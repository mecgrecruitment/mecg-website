-- Alumni directory: members who are graduating (or have graduated) choose to
-- be listed, and choose which details to share, so current members and the
-- board can find them. Nobody is listed unless they add themselves.
--
-- A listing is one row per person. Every detail is optional and empty means
-- "not shared". The name shown is the person's current profile name. Nothing
-- here contacts anyone or publishes anything outside the signed-in workspace.
--
-- Access is only through the actor-checked functions below. RLS is forced
-- with no policies and there are no table grants.
--  * Any active member (any role except PANEL alone, with an active profile)
--    reads the directory and adds, edits or removes their own listing.
--  * Removing your own listing (opting out) needs only a signed-in profile,
--    not an active membership, so leaving the club never blocks opting out.
--  * An active BOARD or OWNER member may also remove someone else's listing,
--    for an alum who asks but can no longer sign in. The board cannot edit
--    or create anyone else's listing.
-- Opting out deletes the row: the shared details are gone, not hidden.
-- Writes carry an optimistic revision. Audit metadata records which fields
-- are shared or changed and the revision, never the shared values.
-- Contact emails may not hold characters that change a mailto: link (? & , ; %
-- quotes, brackets, slashes), so a listing cannot add recipients or a subject.
-- Text may not start or end with any whitespace (\s), so stored values match
-- what the site trims before saving.
create table rush.alumni_listings (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null unique references rush.profiles(id) on delete cascade,
 grad_term text not null default '' check (char_length(grad_term) <= 40 and grad_term !~ '^\s|\s$'),
 major text not null default '' check (char_length(major) <= 120 and major !~ '^\s|\s$'),
 employer text not null default '' check (char_length(employer) <= 120 and employer !~ '^\s|\s$'),
 job_title text not null default '' check (char_length(job_title) <= 120 and job_title !~ '^\s|\s$'),
 location text not null default '' check (char_length(location) <= 120 and location !~ '^\s|\s$'),
 linkedin_url text not null default '' check (linkedin_url='' or (char_length(linkedin_url) <= 300 and linkedin_url ~* '^https://([a-z0-9-]+\.)?linkedin\.com/[^[:space:]]*$')),
 contact_email text not null default '' check (contact_email='' or (char_length(contact_email) <= 254 and contact_email ~ '^[^][:space:]@?&,;%"<>()[\\/]+@[^][:space:]@?&,;%"<>()[\\/]+\.[^][:space:]@?&,;%"<>()[\\/]+$')),
 note text not null default '' check (char_length(note) <= 500 and note !~ '^\s|\s$'),
 revision integer not null default 1 check (revision >= 1),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table rush.alumni_listings enable row level security;
alter table rush.alumni_listings force row level security;
-- No policies and no table grants: access is exclusively through the RPCs.
revoke all on rush.alumni_listings from public, anon, authenticated;

create function rush.alumni_is_member() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id
  where m.user_id=rush.actor_id() and m.active and p.active and m.role<>'PANEL');
$$;

create function rush.alumni_is_board() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id
  where m.user_id=rush.actor_id() and m.active and p.active and m.role in ('BOARD','OWNER'));
$$;

-- The names of the fields a listing shares, in form order.
create function rush.alumni_shared_fields(r rush.alumni_listings) returns text[]
language sql immutable security definer set search_path='' as $$
 select array_remove(array[
  case when r.grad_term<>'' then 'gradTerm' end, case when r.major<>'' then 'major' end,
  case when r.employer<>'' then 'employer' end, case when r.job_title<>'' then 'jobTitle' end,
  case when r.location<>'' then 'location' end, case when r.linkedin_url<>'' then 'linkedinUrl' end,
  case when r.contact_email<>'' then 'contactEmail' end, case when r.note<>'' then 'note' end], null);
$$;

create function rush.alumni_listing_json(r rush.alumni_listings) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',r.id,'isMine',r.profile_id is not distinct from rush.actor_id(),
  'name',(select p.display_name from rush.profiles p where p.id=r.profile_id),
  'gradTerm',r.grad_term,'major',r.major,'employer',r.employer,'jobTitle',r.job_title,'location',r.location,
  'linkedinUrl',r.linkedin_url,'contactEmail',r.contact_email,'note',r.note,
  'revision',r.revision,'updatedAt',r.updated_at);
$$;

-- The whole directory, the caller's own listing (or null), and the caller's
-- profile grad term and major so a first listing can start from them.
create function rush.alumni_directory() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := rush.actor_id();
begin
 if not rush.alumni_is_member() then raise exception 'Active membership required' using errcode='42501'; end if;
 return jsonb_build_object(
  'canRemoveOthers',rush.alumni_is_board(),
  'mine',(select rush.alumni_listing_json(r) from rush.alumni_listings r where r.profile_id=actor),
  'defaults',(select jsonb_build_object('gradTerm',coalesce(btrim(p.grad_term),''),'major',coalesce(btrim(p.major),''))
   from rush.profiles p where p.id=actor),
  'entries',coalesce((select jsonb_agg(rush.alumni_listing_json(r)
   order by lower(coalesce((select p.display_name from rush.profiles p where p.id=r.profile_id),'')), r.id)
   from rush.alumni_listings r),'[]'::jsonb));
end; $$;

-- Adds the caller's listing (expected_revision 0) or edits it at
-- expected_revision. Only ever the caller's own listing.
create function rush.save_alumni_listing(expected_revision integer, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := rush.actor_id();
 old rush.alumni_listings%rowtype;
 r rush.alumni_listings%rowtype;
 changed text[] := '{}';
 k text;
begin
 if not rush.alumni_is_member() then raise exception 'Active membership required' using errcode='42501'; end if;
 if expected_revision is null or expected_revision<0 then raise exception 'Invalid revision' using errcode='22023'; end if;
 if jsonb_typeof(payload) is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(payload) j where j not in ('gradTerm','major','employer','jobTitle','location','linkedinUrl','contactEmail','note'))
  or (select count(*) from jsonb_object_keys(payload))<>8
  or exists(select 1 from jsonb_each(payload) e where jsonb_typeof(e.value)<>'string' or (e.value #>> '{}') ~ '^\s|\s$') then
  raise exception 'Invalid listing form' using errcode='22023'; end if;
 if char_length(payload->>'gradTerm')>40 or char_length(payload->>'major')>120 or char_length(payload->>'employer')>120
  or char_length(payload->>'jobTitle')>120 or char_length(payload->>'location')>120 or char_length(payload->>'note')>500 then
  raise exception 'Shorten the longer fields' using errcode='22023'; end if;
 if payload->>'linkedinUrl'<>'' and (char_length(payload->>'linkedinUrl')>300 or payload->>'linkedinUrl' !~* '^https://([a-z0-9-]+\.)?linkedin\.com/[^[:space:]]*$') then
  raise exception 'The LinkedIn link must be a full https://linkedin.com address' using errcode='22023'; end if;
 if payload->>'contactEmail'<>'' and (char_length(payload->>'contactEmail')>254 or payload->>'contactEmail' !~ '^[^][:space:]@?&,;%"<>()[\\/]+@[^][:space:]@?&,;%"<>()[\\/]+\.[^][:space:]@?&,;%"<>()[\\/]+$') then
  raise exception 'Check the email address' using errcode='22023'; end if;

 select * into old from rush.alumni_listings where profile_id=actor for update;
 if not found then
  if expected_revision<>0 then raise exception 'Your listing was removed since you opened it. Reload before saving.' using errcode='55000'; end if;
  -- A concurrent first save for the same person loses on the unique key.
  insert into rush.alumni_listings(profile_id,grad_term,major,employer,job_title,location,linkedin_url,contact_email,note)
  values(actor,payload->>'gradTerm',payload->>'major',payload->>'employer',payload->>'jobTitle',payload->>'location',
   payload->>'linkedinUrl',payload->>'contactEmail',payload->>'note')
  on conflict (profile_id) do nothing
  returning * into r;
  if r.id is null then raise exception 'Your listing changed since you opened it. Reload before saving.' using errcode='55000'; end if;
  insert into rush.audit_events(actor_id,action,resource,resource_id,metadata)
  values(actor,'ALUMNI_LISTING_ADDED','AlumniListing',r.id::text,
   jsonb_build_object('shared',to_jsonb(rush.alumni_shared_fields(r)),'revision',r.revision));
  return rush.alumni_listing_json(r);
 end if;

 if old.revision<>expected_revision then raise exception 'Your listing changed since you opened it. Reload before saving.' using errcode='55000'; end if;
 foreach k in array array['gradTerm','major','employer','jobTitle','location','linkedinUrl','contactEmail','note'] loop
  if payload->>k <> (case k when 'gradTerm' then old.grad_term when 'major' then old.major when 'employer' then old.employer
   when 'jobTitle' then old.job_title when 'location' then old.location when 'linkedinUrl' then old.linkedin_url
   when 'contactEmail' then old.contact_email else old.note end) then changed := array_append(changed,k); end if;
 end loop;
 -- Saving an unchanged form is not a new revision and leaves no audit entry.
 if cardinality(changed)=0 then return rush.alumni_listing_json(old); end if;
 update rush.alumni_listings set grad_term=payload->>'gradTerm', major=payload->>'major', employer=payload->>'employer',
  job_title=payload->>'jobTitle', location=payload->>'location', linkedin_url=payload->>'linkedinUrl',
  contact_email=payload->>'contactEmail', note=payload->>'note', revision=revision+1, updated_at=now()
  where id=old.id returning * into r;
 insert into rush.audit_events(actor_id,action,resource,resource_id,metadata)
 values(actor,'ALUMNI_LISTING_UPDATED','AlumniListing',r.id::text,
  jsonb_build_object('shared',to_jsonb(rush.alumni_shared_fields(r)),'changed',to_jsonb(changed),'revision',r.revision));
 return rush.alumni_listing_json(r);
end; $$;

-- Opt-out. With target_id null, deletes the caller's own listing; any signed-in
-- profile may do that, and having no listing is not an error (returns false).
-- With a target_id, deletes that listing: the caller's own, or anyone's for an
-- active board member or owner. Someone else's listing id is reported as
-- missing to non-board callers.
create function rush.remove_alumni_listing(target_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := rush.actor_id();
 r rush.alumni_listings%rowtype;
begin
 if actor is null or not exists(select 1 from rush.profiles p where p.id=actor) then
  raise exception 'Sign in to remove your listing' using errcode='42501'; end if;
 if target_id is null then
  delete from rush.alumni_listings where profile_id=actor returning * into r;
  if not found then return false; end if;
 else
  select * into r from rush.alumni_listings where id=target_id for update;
  if not found or (r.profile_id<>actor and not rush.alumni_is_board()) then
   raise exception 'Listing not found' using errcode='P0002'; end if;
  delete from rush.alumni_listings where id=target_id;
 end if;
 insert into rush.audit_events(actor_id,action,resource,resource_id,metadata)
 values(actor,'ALUMNI_LISTING_REMOVED','AlumniListing',r.id::text,
  jsonb_build_object('byOwner',r.profile_id=actor,'shared',to_jsonb(rush.alumni_shared_fields(r)),'revision',r.revision));
 return true;
end; $$;

revoke all on function rush.alumni_is_member(), rush.alumni_is_board(), rush.alumni_shared_fields(rush.alumni_listings),
 rush.alumni_listing_json(rush.alumni_listings), rush.alumni_directory(), rush.save_alumni_listing(integer,jsonb),
 rush.remove_alumni_listing(uuid) from public, anon, authenticated;
grant execute on function rush.alumni_directory(), rush.save_alumni_listing(integer,jsonb), rush.remove_alumni_listing(uuid) to authenticated;
