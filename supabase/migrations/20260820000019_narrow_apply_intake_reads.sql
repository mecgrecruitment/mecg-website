-- Narrow /apply intake reads: authenticated callers get open-cycle + question
-- prompts via SECURITY DEFINER RPCs instead of the service-role client.
-- Service-role remains only for resume Storage + submit_application (SEC-21).

-- Active cycle whose application window is open right now, or null.
create or replace function public.get_open_apply_cycle()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cycle_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select rc.id
    into v_cycle_id
    from public.recruitment_cycles rc
   where rc.is_active = true
     and (rc.applications_open_at is null or rc.applications_open_at <= now())
     and (rc.applications_close_at is null or rc.applications_close_at > now())
   limit 1;

  return v_cycle_id;
end;
$$;

revoke execute on function public.get_open_apply_cycle() from public, anon;
grant execute on function public.get_open_apply_cycle() to authenticated;

-- Safe columns only; p_cycle_id must be the currently open apply cycle.
create or replace function public.list_apply_questions(p_cycle_id uuid)
returns table (
  key text,
  prompt text,
  required boolean,
  sort_order integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if p_cycle_id is null or p_cycle_id is distinct from public.get_open_apply_cycle() then
    return;
  end if;

  return query
    select q.key, q.prompt, q.required, q.sort_order
      from public.application_questions q
     where q.cycle_id = p_cycle_id
     order by q.sort_order;
end;
$$;

revoke execute on function public.list_apply_questions(uuid) from public, anon;
grant execute on function public.list_apply_questions(uuid) to authenticated;
