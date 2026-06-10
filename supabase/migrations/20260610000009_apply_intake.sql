-- Track B2: the single transactional entry point for the /apply Route Handler.
-- PRD SEC-21..SEC-25 / EX-59..EX-61: the handler (service_role) is the ONLY
-- caller; anon/authenticated cannot execute. Rate limit + candidate insert +
-- response snapshots commit or roll back as one transaction.

create or replace function public.submit_application(
  p_candidate_id uuid,
  p_ip_hash text,
  p_cycle_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_year text,
  p_major text,
  p_linkedin_url text,
  p_resume_storage_path text,
  p_responses jsonb -- [{ "key": ..., "question": ..., "response": ... }]
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  r jsonb;
begin
  -- L2 / SEC-24: 5 submissions / IP / 24h. Hourly buckets summed over a
  -- rolling window, incremented in this same transaction.
  insert into public.apply_rate_limit (ip_hash, window_start, count)
  values (p_ip_hash, date_trunc('hour', now()), 1)
  on conflict (ip_hash, window_start)
    do update set count = apply_rate_limit.count + 1;

  select coalesce(sum(count), 0) into v_count
  from public.apply_rate_limit
  where ip_hash = p_ip_hash
    and window_start > now() - interval '24 hours';

  if v_count > 5 then
    raise exception 'rate_limited';
  end if;

  -- C1 / SEC-25: per-cycle uniqueness on (cycle_id, lower(email)). A duplicate
  -- returns 'duplicate' so the handler can answer with the same generic
  -- confirmation as a first submission (enumeration-safe). The rate-limit
  -- increment above still commits.
  begin
    insert into public.candidates (
      id, cycle_id, full_name, email, phone, year, major, linkedin_url,
      resume_storage_path, per_cycle_seq
    ) values (
      p_candidate_id, p_cycle_id, p_full_name, lower(p_email),
      nullif(p_phone, ''), p_year, p_major, nullif(p_linkedin_url, ''),
      p_resume_storage_path, 0 -- seq overwritten by assign_per_cycle_seq trigger
    );
  exception when unique_violation then
    return 'duplicate';
  end;

  for r in select * from jsonb_array_elements(p_responses) loop
    insert into public.application_responses (
      candidate_id, question_key, question_text, response_text
    ) values (
      p_candidate_id, r->>'key', r->>'question', r->>'response'
    );
  end loop;

  return 'ok';
end;
$$;

-- Service-role only: this function bypasses RLS by design (SECURITY DEFINER),
-- so no browser-reachable role may ever execute it (SEC-21).
revoke execute on function public.submit_application(
  uuid, text, uuid, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;

-- Housekeeping: rate-limit buckets older than the rolling window are dead
-- weight; the handler clears them opportunistically.
create or replace function public.prune_apply_rate_limit() returns void
language sql
security definer
set search_path = public
as $$
  delete from public.apply_rate_limit
  where window_start < now() - interval '25 hours';
$$;

revoke execute on function public.prune_apply_rate_limit()
  from public, anon, authenticated;
