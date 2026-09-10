-- resume-upload, resume-finalize and headshot-upload were never listed here, so
-- they fell to the else branch of 5 per 300 seconds. That default is sized for a
-- credential-shaped request, where five attempts in five minutes is already
-- suspicious. A file upload is not that shape: a phone photo or a re-exported
-- PDF fails on size, on page count or on a dropped connection, and the applicant
-- retries immediately, so five tries burns out during one honest attempt to
-- attach a resume. The real abuse bound for uploads is the per-cycle document
-- quota enforced in begin_resume_upload, not this counter; these buckets only
-- need to stop a script hammering storage, which 15 (or 30 finalizes, since one
-- upload can retry its finalize) per 15 minutes still does.
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
    when 'apply-draft' then 1200
    when 'apply-draft-ip' then 60000
    when 'resume-upload' then 15
    when 'resume-finalize' then 30
    when 'headshot-upload' then 15
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
    when 'resume-upload' then 900
    when 'resume-finalize' then 900
    when 'headshot-upload' then 900
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
