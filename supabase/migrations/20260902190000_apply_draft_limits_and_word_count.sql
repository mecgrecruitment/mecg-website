-- Two fixes the night the portal opens, both in the applicant's path.
--
-- 1. apply-draft 60/hour locked students out mid-application. The form autosaves
--    1.2s after each typing pause and the Continue button waits on that save, so
--    a student writing a 300-word, a 250-word and a 50-word essay pauses far more
--    than 60 times in an hour. Past 60 every autosave 429s for the rest of the
--    hour and they cannot reach the review step. 1200/hour is ~1 save every 3s
--    sustained, well past any human writing pace, and still stops a script doing
--    thousands a minute. apply-draft-ip was sized as 150 students x that wrong 60,
--    so it inherited the same error; at 60000 it is a pure runaway backstop that
--    no legitimate hall of 150 writers can reach. 'apply' (10) and 'apply-ip'
--    (500) are unchanged: those guard submission, where the real volume is one to
--    three per applicant and abuse actually matters.
--
-- 2. response_word_count called btrim with its default trim set, which is the
--    space character only. A response ending in a newline kept that newline, so
--    splitting on \s+ produced a trailing empty element and counted one word too
--    many. A student at exactly the limit whose answer ended with a blank line
--    was rejected by the trigger while the browser counter read 50/50. The
--    browser uses String.prototype.trim (all whitespace), so trim with the same
--    \s class the split already uses instead of btrim's space-only default.
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

create or replace function rush.response_word_count(value text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when value is null or pg_catalog.regexp_replace(value, E'^\\s+|\\s+$', '', 'g') = '' then 0
    else pg_catalog.array_length(
      pg_catalog.regexp_split_to_array(
        pg_catalog.regexp_replace(value, E'^\\s+|\\s+$', '', 'g'),
        E'\\s+'
      ),
      1
    )
  end;
$$;
revoke all on function rush.response_word_count(text) from public, anon, authenticated;
grant execute on function rush.response_word_count(text) to service_role;
