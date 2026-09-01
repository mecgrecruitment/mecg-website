-- Automatic nudges. The board had no way to remind an evaluator that a round
-- closes tomorrow except to message them personally.
--
-- Postgres cannot call the email provider, so the work splits: this decides who
-- is owed a reminder, and the scheduled route sends and records it. That also
-- keeps the sending path identical to every other email in the system.
--
-- rush.reminders_sent is what makes the job idempotent. A cron that runs hourly
-- must not send the same nudge every hour, and a unique key is a smaller and
-- more reliable guard than tracking a cursor.
create table if not exists rush.reminders_sent (
  id text primary key default gen_random_uuid()::text,
  kind text not null check (char_length(trim(kind)) between 1 and 60),
  subject_id text not null,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (kind, subject_id, recipient_id)
);

alter table rush.reminders_sent enable row level security;
alter table rush.reminders_sent force row level security;
-- No policies and no grants: only the scheduler, running as service_role,
-- touches this table. Matching every other internal bookkeeping table here.

-- Returns evaluators with work still open on a round that closes within 48
-- hours, skipping anyone already reminded for that round.
create or replace function rush.pending_reminders()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.role() is distinct from 'service_role' then '[]'::jsonb
    else coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', 'EVALUATION_DUE',
        'subjectId', r.id,
        'recipientId', a.evaluator_id,
        'email', u.email,
        'name', p.display_name,
        'detail', r.name,
        'dueAt', r.closes_at
      ))
      from rush.evaluation_assignments a
      join rush.rounds r on r.id = a.round_id
      join rush.profiles p on p.id = a.evaluator_id
      join auth.users u on u.id = a.evaluator_id
      where r.status = 'ACTIVE'
        and r.closes_at is not null
        and r.closes_at between now() and now() + interval '48 hours'
        and a.status in ('ASSIGNED', 'IN_PROGRESS')
        and p.active
        and u.email is not null
        and not exists (
          select 1 from rush.reminders_sent s
          where s.kind = 'EVALUATION_DUE' and s.subject_id = r.id and s.recipient_id = a.evaluator_id
        )
    ), '[]'::jsonb)
  end;
$$;

revoke all on function rush.pending_reminders() from public, anon, authenticated;
grant execute on function rush.pending_reminders() to service_role;

-- Recorded whether or not delivery succeeded. A provider outage should not
-- turn into the same nudge every hour until it recovers; the board can see the
-- failure in the message log and follow up once.
create or replace function rush.mark_reminder_sent(reminder_kind text, subject_id text, recipient_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  insert into rush.reminders_sent (kind, subject_id, recipient_id)
  values (trim(reminder_kind), subject_id, recipient_id)
  on conflict (kind, subject_id, recipient_id) do nothing;
  return true;
end;
$$;

revoke all on function rush.mark_reminder_sent(text, text, uuid) from public, anon, authenticated;
grant execute on function rush.mark_reminder_sent(text, text, uuid) to service_role;
