-- Board can grant (or restore) membership for an existing auth account by email,
-- without waiting on a membership_requests row or hand-writing SQL.

create or replace function public.grant_membership_by_email(
  p_email text,
  p_role public.member_role,
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_user_email text;
  v_meta_name text;
  v_member_id uuid;
  v_name text;
begin
  if not coalesce(public.is_board(), false) then
    raise exception 'only board can grant membership';
  end if;

  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'email is required';
  end if;

  select u.id, u.email, u.raw_user_meta_data ->> 'full_name'
    into v_user_id, v_user_email, v_meta_name
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'no account found for % — add them to the invite list, or ask them to sign up first', trim(p_email);
  end if;

  v_name := coalesce(
    nullif(trim(p_full_name), ''),
    nullif(trim(v_meta_name), ''),
    v_user_email
  );

  insert into public.members (user_id, email, full_name, role, deleted_at)
  values (v_user_id, v_user_email, v_name, p_role, null)
  on conflict (user_id) do update
    set role = excluded.role,
        email = excluded.email,
        full_name = excluded.full_name,
        deleted_at = null,
        updated_at = now()
  returning id into v_member_id;

  update public.membership_requests
  set status = 'approved',
      reviewed_by = public.current_member_id(),
      reviewed_at = now()
  where user_id = v_user_id
    and status = 'pending';

  return v_member_id;
end;
$$;

revoke execute on function public.grant_membership_by_email(text, public.member_role, text) from public, anon;
grant execute on function public.grant_membership_by_email(text, public.member_role, text) to authenticated;
