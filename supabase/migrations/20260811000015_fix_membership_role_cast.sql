-- Keep the CASE expression typed as member_role; otherwise PL/pgSQL resolves
-- the string literals as text before assigning them to the enum variable.

create or replace function public.request_membership(
  p_full_name text,
  p_requested_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(auth.email());
  v_role public.member_role := case
    when p_requested_role = 'board' then 'board'::public.member_role
    else 'recruitment_committee'::public.member_role
  end;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;
  if exists (select 1 from public.members where user_id = v_uid and deleted_at is null) then
    raise exception 'already a member';
  end if;

  insert into public.membership_requests (user_id, email, full_name, requested_role, status)
  values (v_uid, v_email, coalesce(nullif(trim(p_full_name), ''), v_email), v_role, 'pending')
  on conflict (user_id) do update
    set full_name      = excluded.full_name,
        requested_role = excluded.requested_role,
        status         = 'pending',
        reviewed_by    = null,
        reviewed_at    = null,
        updated_at     = now();
end;
$$;

revoke execute on function public.request_membership(text, public.member_role) from public, anon;
grant execute on function public.request_membership(text, public.member_role) to authenticated;
