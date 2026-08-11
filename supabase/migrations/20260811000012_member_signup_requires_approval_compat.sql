-- Compatibility marker for databases that applied migration 12 under its
-- original 20260811 timestamp. Reapplying the function is idempotent and keeps
-- fresh databases and existing environments on the approval-queue behavior.

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

  if found then
    insert into public.membership_requests (user_id, email, full_name, requested_role, status)
    values (
      new.id,
      new.email,
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        initcap(replace(split_part(new.email, '@', 1), '.', ' '))
      ),
      v_allow.role,
      'pending'
    );

    update public.invite_allowlist
       set consumed_at = now()
     where id = v_allow.id;
  end if;

  return new;
end;
$$;
