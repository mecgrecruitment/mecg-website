-- The apply routes key their bucket on `${user.id}:${ip}` so a shared campus
-- NAT cannot 429 a whole lecture hall. That key alone is not a ceiling: one
-- host minting N Clerk accounts gets N full buckets. The routes now also check
-- a second, IP-only bucket, and these are its limits.
--
-- Sizing assumes the worst realistic Festifall crowd behind one egress IP:
-- ~150 distinct students per hour.
--   apply-ip 500/hour: a real applicant submits once, twice or three times
--     (retry, resubmit after "needs info"). 150 x 3 = 450, so a legitimate
--     hall never reaches 500, while a script is stopped three orders of
--     magnitude short of what an unbounded bucket allows.
--   apply-draft-ip 9000/hour: autosave, so the volume is per keystroke burst
--     (1.2s debounce) and the per-user apply-draft cap is already 60/hour.
--     150 x 60 = 9000 is exactly the sum of the per-user caps for that crowd,
--     which is the largest number no legitimate group of 150 can exceed.
-- Both are fixed windows, inheriting the caveat on the original function.
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
    when 'apply-ip' then 500
    when 'apply-draft' then 60
    when 'apply-draft-ip' then 9000
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
    when 'apply-ip' then 3600
    when 'apply-draft' then 3600
    when 'apply-draft-ip' then 3600
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
