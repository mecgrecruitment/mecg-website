-- Model resume uploads as documents instead of trusting a browser-provided path.
-- The browser still uploads bytes directly to the private bucket, but it can
-- only insert an object for a pending document created by begin_resume_upload.

create table rush.application_documents (
  id text primary key default gen_random_uuid()::text,
  application_id text references rush.applications (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  cycle_id text not null references rush.rush_cycles (id) on delete cascade,
  kind text not null default 'RESUME' check (kind = 'RESUME'),
  object_path text not null unique check (
    object_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]+/([0-9a-f-]{36}|resume)\.pdf$'
  ),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  declared_size integer not null check (declared_size between 1 and 10485760),
  verified_size integer check (verified_size between 1 and 10485760),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  page_count integer check (page_count is null or page_count between 1 and 20),
  status text not null default 'PENDING' check (
    status in ('PENDING', 'READY', 'ATTACHED', 'REJECTED', 'SUPERSEDED', 'DELETED')
  ),
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 240),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  superseded_at timestamptz,
  deleted_at timestamptz
);

-- Preserve already-submitted resumes when this migration reaches an existing
-- project. They have passed the former bucket/path checks, but do not have the
-- richer verification metadata introduced here.
insert into rush.application_documents (
  application_id, owner_user_id, cycle_id, object_path, original_filename,
  declared_size, verified_size, status, ready_at
)
select
  a.id, p.auth_user_id, a.cycle_id, a.resume_storage_path, 'Previously uploaded resume.pdf',
  greatest(1, least(10485760, case
    when o.metadata ->> 'size' ~ '^[0-9]+$' then (o.metadata ->> 'size')::integer
    else 1
  end)),
  greatest(1, least(10485760, case
    when o.metadata ->> 'size' ~ '^[0-9]+$' then (o.metadata ->> 'size')::integer
    else 1
  end)),
  'ATTACHED', coalesce(a.submitted_at, a.created_at)
from rush.applications a
join rush.pnms p on p.id = a.pnm_id and p.auth_user_id is not null
join storage.objects o on o.bucket_id = 'resumes' and o.name = a.resume_storage_path
where a.resume_storage_path is not null
on conflict (object_path) do nothing;

create index application_documents_owner_cycle_created_idx
  on rush.application_documents (owner_user_id, cycle_id, created_at desc);
create unique index application_documents_one_ready_resume_idx
  on rush.application_documents (owner_user_id, cycle_id, kind)
  where status = 'READY';
create unique index application_documents_one_attached_resume_idx
  on rush.application_documents (owner_user_id, cycle_id, kind)
  where status = 'ATTACHED';

alter table rush.application_documents enable row level security;
alter table rush.application_documents force row level security;

create policy application_documents_owner_read on rush.application_documents
for select to authenticated
using (owner_user_id = auth.uid());

create policy application_documents_internal_read on rush.application_documents
for select to authenticated
using (
  status = 'ATTACHED'
  and exists (
    select 1
    from rush.memberships m
    join rush.profiles p on p.id = m.user_id
    where m.user_id = auth.uid() and m.cycle_id = application_documents.cycle_id
      and m.active and p.active
      and m.role::text in ('BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE')
  )
  and not exists (
    select 1 from rush.conflict_declarations c
    where c.application_id = application_documents.application_id and c.declarer_id = auth.uid()
  )
);

grant select on rush.application_documents to authenticated;
grant all on rush.application_documents to service_role;

create or replace function rush.begin_resume_upload(
  upload_filename text,
  upload_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_cycle_id text;
  target_application_id text;
  document_id text := gen_random_uuid()::text;
  object_name text;
  safe_filename text := regexp_replace(trim(upload_filename), '[[:cntrl:]/\\]', '_', 'g');
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if upload_size is null or upload_size not between 1 and 10485760 then
    raise exception 'invalid file size' using errcode = '22023';
  end if;
  if char_length(safe_filename) not between 1 and 255 or safe_filename !~* '\.pdf$' then
    raise exception 'invalid filename' using errcode = '22023';
  end if;

  select id into target_cycle_id
  from rush.rush_cycles
  where status = 'OPEN'
    and (opens_at is null or opens_at <= now())
    and (closes_at is null or closes_at >= now())
  order by created_at desc
  limit 1;
  if target_cycle_id is null then
    raise exception 'applications are not open' using errcode = '55000';
  end if;

  select a.id into target_application_id
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor
    and a.cycle_id = target_cycle_id
    and a.status in ('DRAFT', 'NEEDS_INFO')
  for update of a;
  if target_application_id is null then
    raise exception 'save the application before uploading' using errcode = '55000';
  end if;

  if (
    select count(*) from rush.application_documents d
    where d.owner_user_id = actor
      and d.created_at >= now() - interval '1 hour'
  ) >= 10 then
    raise exception 'upload limit reached' using errcode = '55000';
  end if;

  if (
    select count(*) from rush.application_documents d
    where d.owner_user_id = actor and d.cycle_id = target_cycle_id
  ) >= 20 then
    raise exception 'replacement limit reached' using errcode = '55000';
  end if;

  object_name := actor::text || '/' || target_cycle_id || '/' || document_id || '.pdf';
  insert into rush.application_documents (
    id, application_id, owner_user_id, cycle_id, object_path,
    original_filename, declared_size
  ) values (
    document_id, target_application_id, actor, target_cycle_id, object_name,
    safe_filename, upload_size
  );

  return jsonb_build_object('documentId', document_id, 'path', object_name);
end;
$$;

create or replace function rush.pending_resume_upload(target_document_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'documentId', d.id,
    'path', d.object_path,
    'declaredSize', d.declared_size,
    'filename', d.original_filename
  )
  from rush.application_documents d
  where d.id = target_document_id
    and d.owner_user_id = auth.uid()
    and d.status = 'PENDING'
    and d.created_at >= now() - interval '1 hour';
$$;

create or replace function rush.finalize_resume_upload(
  target_document_id text,
  actual_size integer,
  content_sha256 text,
  detected_page_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  target_document rush.application_documents%rowtype;
  old_paths jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  if actual_size is null or actual_size not between 1 and 10485760
    or content_sha256 !~ '^[0-9a-f]{64}$'
    or detected_page_count is null or detected_page_count not between 1 and 20 then
    raise exception 'invalid document metadata' using errcode = '22023';
  end if;

  select * into target_document
  from rush.application_documents
  where id = target_document_id
  for update;
  if target_document.id is null then raise exception 'document not found' using errcode = 'P0002'; end if;
  actor := target_document.owner_user_id;
  if target_document.status <> 'PENDING' or target_document.created_at < now() - interval '1 hour' then
    raise exception 'upload expired' using errcode = '55000';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'resumes'
      and o.name = target_document.object_path
      and coalesce((o.metadata ->> 'size')::integer, actual_size) = actual_size
  ) then
    raise exception 'uploaded object missing' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(d.object_path), '[]'::jsonb) into old_paths
  from rush.application_documents d
  where d.owner_user_id = actor
    and d.cycle_id = target_document.cycle_id
    and d.kind = 'RESUME'
    and d.status = 'READY'
    and d.id <> target_document.id;

  update rush.application_documents
  set status = 'SUPERSEDED', superseded_at = now()
  where owner_user_id = actor
    and cycle_id = target_document.cycle_id
    and kind = 'RESUME'
    and status = 'READY'
    and id <> target_document.id;

  update rush.application_documents
  set status = 'READY', verified_size = actual_size, sha256 = content_sha256,
      page_count = detected_page_count, ready_at = now(), rejection_reason = null
  where id = target_document.id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (
    actor, target_document.cycle_id, 'RESUME_UPLOAD_READY',
    'ApplicationDocument', target_document.id,
    jsonb_build_object('size', actual_size, 'sha256', content_sha256, 'pageCount', detected_page_count)
  );

  return jsonb_build_object(
    'documentId', target_document.id,
    'path', target_document.object_path,
    'filename', target_document.original_filename,
    'size', actual_size,
    'pageCount', detected_page_count,
    'supersededPaths', old_paths
  );
end;
$$;

create or replace function rush.reject_resume_upload(
  target_document_id text,
  rejection text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_document rush.application_documents%rowtype;
begin
  select * into target_document
  from rush.application_documents
  where id = target_document_id
  for update;
  if actor is null or target_document.id is null or target_document.owner_user_id <> actor then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_document.status <> 'PENDING' then
    raise exception 'upload is not pending' using errcode = '55000';
  end if;
  update rush.application_documents
  set status = 'REJECTED', rejection_reason = left(coalesce(nullif(trim(rejection), ''), 'invalid PDF'), 240)
  where id = target_document.id;
  return target_document.object_path;
end;
$$;

create or replace function rush.my_ready_resume(target_path text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'documentId', d.id,
    'path', d.object_path,
    'filename', d.original_filename,
    'size', d.verified_size,
    'pageCount', d.page_count,
    'readyAt', d.ready_at
  )
  from rush.application_documents d
  where d.owner_user_id = auth.uid()
    and d.status in ('READY', 'ATTACHED')
    and (target_path is null or d.object_path = target_path)
  order by d.ready_at desc
  limit 1;
$$;

create or replace function rush.authorize_resume_access(target_application_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_application rush.applications%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into target_application from rush.applications where id = target_application_id;
  if target_application.id is null or target_application.resume_storage_path is null then
    raise exception 'resume not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1
    from rush.memberships m
    join rush.profiles p on p.id = m.user_id
    where m.user_id = actor and m.cycle_id = target_application.cycle_id
      and m.active and p.active
      and m.role::text in ('BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE')
  ) then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (
    select 1 from rush.conflict_declarations c
    where c.application_id = target_application.id and c.declarer_id = actor
  ) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (
    select 1 from rush.application_documents d
    where d.object_path = target_application.resume_storage_path and d.status = 'ATTACHED'
  ) then raise exception 'resume not ready' using errcode = '55000'; end if;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, target_application.cycle_id, 'RESUME_VIEWED', 'Application', target_application.id);
  return target_application.resume_storage_path;
end;
$$;

create or replace function rush.require_ready_resume()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_owner uuid;
begin
  if new.resume_storage_path is null then return new; end if;
  select p.auth_user_id into application_owner from rush.pnms p where p.id = new.pnm_id;
  if not exists (
    select 1 from rush.application_documents d
    where d.object_path = new.resume_storage_path
      and d.owner_user_id = application_owner
      and d.cycle_id = new.cycle_id
      and d.status in ('READY', 'ATTACHED')
  ) then raise exception 'verified resume required' using errcode = '22023'; end if;

  if tg_op = 'INSERT' or old.resume_storage_path is distinct from new.resume_storage_path then
    update rush.application_documents
    set status = 'SUPERSEDED', superseded_at = now()
    where owner_user_id = application_owner and cycle_id = new.cycle_id
      and kind = 'RESUME' and status = 'ATTACHED'
      and object_path <> new.resume_storage_path;
    update rush.application_documents
    set status = 'ATTACHED', application_id = new.id
    where object_path = new.resume_storage_path and owner_user_id = application_owner;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_require_ready_resume on rush.applications;
create trigger applications_require_ready_resume
before insert or update of resume_storage_path on rush.applications
for each row execute function rush.require_ready_resume();

-- Keep the database-only workflow rehearsal compatible with the new invariant.
-- This function is already restricted to its synthetic workflow identity.
create or replace function rush.submit_application_self_test(applicant_name text, applicant_contact text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  cycle_id text;
  resume_path text;
begin
  if actor is null or applicant_contact <> ('workflow-' || actor::text || '@example.invalid') then
    raise exception 'workflow self-test only' using errcode = '42501';
  end if;
  select id into cycle_id from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;
  if cycle_id is null then raise exception 'applications are not open' using errcode = '55000'; end if;
  resume_path := actor::text || '/' || cycle_id || '/' || gen_random_uuid()::text || '.pdf';
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('resumes', resume_path, actor::text, jsonb_build_object('mimetype', 'application/pdf', 'size', 1));
  insert into rush.application_documents (
    owner_user_id, cycle_id, object_path, original_filename, declared_size,
    verified_size, page_count, sha256, status, ready_at
  ) values (
    actor, cycle_id, resume_path, 'workflow-resume.pdf', 1,
    1, 1, repeat('0', 64), 'READY', now()
  );
  return rush.submit_application(
    applicant_name, applicant_contact, null, null, null, null, null, resume_path, '{}'::jsonb, true
  );
end;
$$;

revoke all on function rush.begin_resume_upload(text, integer), rush.pending_resume_upload(text),
  rush.finalize_resume_upload(text, integer, text, integer), rush.reject_resume_upload(text, text),
  rush.my_ready_resume(text), rush.authorize_resume_access(text) from public, anon;
revoke all on function rush.finalize_resume_upload(text, integer, text, integer) from authenticated;
grant execute on function rush.begin_resume_upload(text, integer), rush.pending_resume_upload(text),
  rush.reject_resume_upload(text, text),
  rush.my_ready_resume(text), rush.authorize_resume_access(text) to authenticated, service_role;
grant execute on function rush.finalize_resume_upload(text, integer, text, integer) to service_role;

-- Replace the broad owner-folder write rules. A caller can only create the
-- exact object path issued for a still-pending document.
drop policy if exists storage_resumes_applicant_insert on storage.objects;
drop policy if exists storage_resumes_applicant_update on storage.objects;
drop policy if exists storage_resumes_applicant_delete on storage.objects;
drop policy if exists storage_resumes_applicant_select on storage.objects;
drop policy if exists storage_resumes_board_select_rush on storage.objects;

create policy storage_resumes_applicant_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'resumes'
  and exists (
    select 1 from rush.application_documents d
    where d.object_path = name
      and d.owner_user_id = auth.uid()
      and d.status = 'PENDING'
      and d.created_at >= now() - interval '1 hour'
  )
);

create policy storage_resumes_applicant_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1 from rush.application_documents d
    where d.object_path = name
      and d.owner_user_id = auth.uid()
      and d.status in ('PENDING', 'REJECTED', 'SUPERSEDED')
  )
);

create policy storage_resumes_applicant_select on storage.objects for select to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1 from rush.application_documents d
    where d.object_path = name
      and d.owner_user_id = auth.uid()
      and d.status in ('PENDING', 'READY', 'ATTACHED')
  )
);

create policy storage_resumes_internal_select on storage.objects for select to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1
    from rush.application_documents d
    join rush.memberships m on m.cycle_id = d.cycle_id and m.user_id = auth.uid() and m.active
    join rush.profiles p on p.id = m.user_id and p.active
    where d.object_path = name
      and d.status = 'ATTACHED'
      and m.role::text in ('BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE')
      and not exists (
        select 1 from rush.conflict_declarations c
        where c.application_id = d.application_id and c.declarer_id = auth.uid()
      )
  )
);
