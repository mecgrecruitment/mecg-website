-- complete_notification gated itself on current_setting('request.jwt.claim.role'),
-- a legacy PostgREST GUC that is no longer populated, so the check never saw
-- 'service_role' and the function raised 42501 for every caller. Nothing
-- exercised it until the application receipt path went live, and then the first
-- real submission sent its email and failed on the bookkeeping call right after,
-- leaving the outbox row stuck in PROCESSING.
--
-- claim_notification, rewritten in 20260907120000, already uses auth.role() and
-- works. This is the same check, so the pair agrees again. Everything else in
-- the body is unchanged.
create or replace function rush.complete_notification(
  target_notification_id text,
  was_delivered boolean,
  provider_id text default null,
  error_category text default null,
  should_retry boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  item rush.notification_outbox%rowtype;
  next_status text;
  delay_minutes integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select * into item from rush.notification_outbox where id = target_notification_id for update;
  if item.id is null then raise exception 'notification missing' using errcode = 'P0002'; end if;
  if item.status = 'SENT' then return item.status; end if;
  if item.status <> 'PROCESSING' then raise exception 'notification is not claimed' using errcode = '55000'; end if;

  if coalesce(was_delivered, false) then
    update rush.notification_outbox
    set status = 'SENT', sent_at = now(), next_attempt_at = now(),
        provider_message_id = nullif(left(trim(provider_id), 200), ''), last_error_category = null
    where id = item.id;
    next_status := 'SENT';
  elsif coalesce(should_retry, false) and item.attempt_count < item.max_attempts then
    delay_minutes := least(360, 5 * (2 ^ greatest(0, item.attempt_count - 1))::integer);
    update rush.notification_outbox
    set status = 'PENDING', next_attempt_at = now() + make_interval(mins => delay_minutes),
        last_error_category = coalesce(nullif(left(trim(error_category), 60), ''), 'UNKNOWN')
    where id = item.id;
    next_status := 'PENDING';
  else
    update rush.notification_outbox
    set status = 'FAILED', next_attempt_at = now(),
        last_error_category = coalesce(nullif(left(trim(error_category), 60), ''), 'UNKNOWN')
    where id = item.id;
    next_status := 'FAILED';
  end if;
  return next_status;
end;
$$;
revoke all on function rush.complete_notification(text, boolean, text, text, boolean) from public, anon, authenticated;
grant execute on function rush.complete_notification(text, boolean, text, text, boolean) to service_role;
