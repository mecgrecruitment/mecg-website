-- Smoke test: an invite_allowlist match creates a pending membership_requests
-- row, not an instant members row. Run against the LOCAL stack only:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/member_signup_approval.sql
-- Everything runs inside one transaction and rolls back. Prints PASS on success;
-- any failure aborts with an exception (ON_ERROR_STOP).

\set ON_ERROR_STOP on

begin;

insert into public.invite_allowlist (email, role, notes)
values ('pending-test@umich.edu', 'recruitment_committee', 'signup-approval smoke test');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'pending-test@umich.edu',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('full_name', 'Pending Tester'),
  now(),
  now(),
  '', '', '', '', '', '', '', ''
);

select set_config('test.new_uid', (select id::text from auth.users where email = 'pending-test@umich.edu'), false);

do $$
declare
  n_members  int;
  n_requests int;
  v_status   public.membership_request_status;
  v_consumed timestamptz;
begin
  select count(*) into n_members from public.members
   where user_id = current_setting('test.new_uid')::uuid;
  if n_members <> 0 then
    raise exception 'FAIL: allowlist match granted an instant members row';
  end if;

  select count(*), min(status) into n_requests, v_status from public.membership_requests
   where user_id = current_setting('test.new_uid')::uuid;
  if n_requests <> 1 or v_status <> 'pending' then
    raise exception 'FAIL: expected exactly one pending membership_requests row, got % (status %)', n_requests, v_status;
  end if;

  select consumed_at into v_consumed from public.invite_allowlist
   where email = 'pending-test@umich.edu';
  if v_consumed is null then
    raise exception 'FAIL: invite_allowlist row was not consumed';
  end if;

  raise notice 'PASS: allowlist match created a pending membership_requests row and consumed the invite';
end $$;

rollback;
