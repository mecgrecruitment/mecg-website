create table rush.rate_limits (
  bucket text primary key,
  count int not null default 1,
  window_start timestamptz not null default now()
);
alter table rush.rate_limits enable row level security;
alter table rush.rate_limits force row level security;
-- no policies: RPC-only access, matching rush.screening_* tables' pattern

-- ponytail: fixed-window counter, switch to sliding window if burst-at-window-edge abuse shows up
--
-- p_max/p_window_seconds are NOT caller-supplied: this function is an
-- internal helper for server-side route handlers, not a public API. The
-- policy is keyed off the bucket-name prefix and enforced inside the
-- function so a direct PostgREST/RPC caller can't reset or loosen their own
-- limit (previously: anon could call this with p_window_seconds=0 to force
-- an immediate reset on any bucket, fully bypassing throttling). EXECUTE is
-- restricted to service_role -- callers must use the admin client
-- (src/lib/supabase/admin.ts), not the user-session client.
create or replace function rush.check_rate_limit(p_bucket text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_max int;
  v_window_seconds int;
  v_prefix text := split_part(p_bucket, ':', 1);
begin
  v_max := case v_prefix
    when 'login' then 10
    when 'login-email' then 10
    when 'signup' then 5
    when 'forgot-password' then 5
    when 'forgot-password-email' then 5
    when 'apply' then 10
    when 'apply-draft' then 60
    when 'interest' then 10
    else 5
  end;
  v_window_seconds := case v_prefix
    when 'login' then 900
    when 'login-email' then 900
    when 'signup' then 3600
    when 'forgot-password' then 3600
    when 'forgot-password-email' then 3600
    when 'apply' then 3600
    when 'apply-draft' then 3600
    when 'interest' then 3600
    else 300
  end;

  insert into rush.rate_limits (bucket, count, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
    set count = case when rush.rate_limits.window_start < now() - (v_window_seconds || ' seconds')::interval
                 then 1 else rush.rate_limits.count + 1 end,
        window_start = case when rush.rate_limits.window_start < now() - (v_window_seconds || ' seconds')::interval
                        then now() else rush.rate_limits.window_start end
  returning count into v_count;
  return v_count <= v_max;
end;
$$;
revoke all on function rush.check_rate_limit(text) from public;
grant execute on function rush.check_rate_limit(text) to service_role;
create or replace function rush.prune_rate_limits()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from rush.rate_limits where window_start < now() - interval '1 day';
end;
$$;
revoke all on function rush.prune_rate_limits() from public;
grant execute on function rush.prune_rate_limits() to service_role;
