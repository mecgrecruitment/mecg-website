-- Claim before sending. The reminders route used to send the email and then
-- record it, so two overlapping cron runs read the same pending_reminders()
-- list and both delivered, and a failed recording resent on the next run.
-- mark_reminder_sent could not arbitrate that: it swallowed the conflict and
-- always returned true, discarding the one fact the caller needed, which is
-- whether it was the row's author.
--
-- The unique key on (kind, subject_id, recipient_id) already decides the race;
-- this only reports its verdict. The winner inserts and sends, the loser gets
-- false and sends nothing.
--
-- The tradeoff is deliberate. Claiming first can lose a reminder, but only if
-- the send fails AND the release that undoes the claim also fails, which needs
-- two failures in the same run. Sending first duplicated on every overlap. A
-- rare missed nudge is a better failure than a routine duplicate one: the
-- board can see the open evaluation, and nobody trusts a mailbox that repeats
-- itself.
create or replace function rush.claim_reminder(reminder_kind text, subject_id text, recipient_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  -- Positional $1/$2/$3 because the parameter names match the column names and
  -- PL/pgSQL would otherwise resolve them ambiguously.
  insert into rush.reminders_sent (kind, subject_id, recipient_id)
  values (trim($1), $2, $3)
  on conflict on constraint reminders_sent_kind_subject_id_recipient_id_key do nothing
  returning id into claimed_id;
  return claimed_id is not null;
end;
$$;
revoke all on function rush.claim_reminder(text, text, uuid) from public, anon, authenticated;
grant execute on function rush.claim_reminder(text, text, uuid) to service_role;

-- Undoes a claim whose send then failed, so the next run retries it instead of
-- treating a nudge that never left the building as delivered.
create or replace function rush.release_reminder(reminder_kind text, subject_id text, recipient_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  delete from rush.reminders_sent s
  where s.kind = trim($1) and s.subject_id = $2 and s.recipient_id = $3;
end;
$$;
revoke all on function rush.release_reminder(text, text, uuid) from public, anon, authenticated;
grant execute on function rush.release_reminder(text, text, uuid) to service_role;

-- Nothing calls this now, and leaving it would leave the send-then-mark race
-- one import away.
drop function if exists rush.mark_reminder_sent(text, text, uuid);
