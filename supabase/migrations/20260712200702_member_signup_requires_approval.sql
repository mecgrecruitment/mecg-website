-- Phase 0 · Migration 12: member signups require explicit board approval.
-- An invite_allowlist match no longer auto-grants a `members` row on signup;
-- it now creates a pending `membership_requests` row, reviewed through the
-- existing board approval queue (approveMembership()/denyMembership() in
-- app/internal/members/actions.ts, surfaced at /internal/members and
-- /auth/request-access). Recruit/applicant signup (no allowlist match) is
-- unaffected — they stay member-less exactly as before.

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

  -- No allowlist row ⇒ this is an applicant, not a member. Leave them
  -- member-less; current_member_role() returns NULL ⇒ applicant routing.
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
;
