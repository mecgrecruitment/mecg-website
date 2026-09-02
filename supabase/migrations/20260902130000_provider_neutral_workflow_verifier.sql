-- The protected workflow verifier must exercise the identity that its fixture
-- actually owns. Clerk-only profiles do not have a legacy Supabase UUID
-- identity, so a hard-coded legacy issuer makes the real verifier fail even
-- though pgTAP's legacy fixtures pass.
create or replace function rush.workflow_test_claims(target_user_id uuid, target_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  identity_row rush.auth_identities%rowtype;
begin
  if target_role not in ('authenticated', 'service_role') then
    raise exception 'invalid workflow test role' using errcode = '22023';
  end if;

  select * into identity_row
  from rush.auth_identities i
  where i.app_user_id = target_user_id and i.disabled_at is null
  -- Prefer a real external identity when one exists. Legacy-only pgTAP
  -- profiles still fall back to their UUID-subject identity.
  order by (i.subject = target_user_id::text), i.created_at desc
  limit 1;

  if identity_row.subject is null then
    raise exception 'workflow test identity missing' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'iss', identity_row.issuer,
    'sub', identity_row.subject,
    'role', target_role
  )::text;
end;
$$;

-- This helper is an implementation detail of the service-only verifier. The
-- verifier runs as its owning role and can call it without exposing a new RPC.
revoke all on function rush.workflow_test_claims(uuid, text) from public, anon, authenticated, service_role;

do $migration$
declare
  definition text;
  legacy_issuer text := 'https://chrxtsohxazngabdcpzb.supabase.co/auth/v1';
begin
  definition := pg_get_functiondef('rush.verify_full_workflow(uuid,uuid,uuid)'::regprocedure);
  definition := replace(
    definition,
    'jsonb_build_object(''iss'',''' || legacy_issuer || ''',''sub'',owner_id,''role'',''authenticated'')::text',
    'rush.workflow_test_claims(owner_id,''authenticated'')'
  );
  definition := replace(
    definition,
    'jsonb_build_object(''iss'',''' || legacy_issuer || ''',''sub'',panel_id,''role'',''authenticated'')::text',
    'rush.workflow_test_claims(panel_id,''authenticated'')'
  );
  definition := replace(
    definition,
    'jsonb_build_object(''iss'',''' || legacy_issuer || ''',''sub'',applicant_id,''role'',''authenticated'')::text',
    'rush.workflow_test_claims(applicant_id,''authenticated'')'
  );
  definition := replace(
    definition,
    'jsonb_build_object(''iss'',''' || legacy_issuer || ''',''sub'',applicant_id,''role'',''service_role'')::text',
    'rush.workflow_test_claims(applicant_id,''service_role'')'
  );

  if position(legacy_issuer in definition) > 0
     or position('workflow_test_claims(applicant_id,''service_role'')' in definition) = 0 then
    raise exception 'could not make workflow verifier provider-neutral';
  end if;
  execute definition;
end;
$migration$;
