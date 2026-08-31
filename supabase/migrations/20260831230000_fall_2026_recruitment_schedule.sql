do $migration$
declare
  target_cycle_id text;
  scheduled_event record;
begin
  select id into target_cycle_id
  from rush.rush_cycles
  where name = 'Fall 2026 Rush'
  order by created_at desc
  limit 1;

  if target_cycle_id is null then
    raise exception 'Fall 2026 Rush cycle not found';
  end if;

  update rush.rush_cycles
  set
    status = 'OPEN',
    opens_at = make_timestamptz(2026, 9, 8, 19, 30, 0, 'America/Detroit'),
    closes_at = make_timestamptz(2026, 9, 11, 11, 0, 0, 'America/Detroit'),
    updated_at = now()
  where id = target_cycle_id;

  for scheduled_event in
    select * from (values
      (
        'Festifall',
        'GENERAL',
        make_timestamptz(2026, 9, 2, 18, 0, 0, 'America/Detroit'),
        make_timestamptz(2026, 9, 2, 20, 0, 0, 'America/Detroit'),
        'Diag & Regents Plaza, Table E-067'
      ),
      (
        'Mass Meeting',
        'MASS_MEETING',
        make_timestamptz(2026, 9, 8, 19, 30, 0, 'America/Detroit'),
        make_timestamptz(2026, 9, 8, 20, 30, 0, 'America/Detroit'),
        'CCCB 0420'
      ),
      (
        'Career Panel',
        'GENERAL',
        make_timestamptz(2026, 9, 9, 19, 0, 0, 'America/Detroit'),
        make_timestamptz(2026, 9, 9, 20, 30, 0, 'America/Detroit'),
        'CCCB 3420'
      ),
      (
        'Meet the Members',
        'MIXER',
        make_timestamptz(2026, 9, 10, 18, 0, 0, 'America/Detroit'),
        make_timestamptz(2026, 9, 10, 19, 30, 0, 'America/Detroit'),
        'CCCB 3420'
      )
    ) as schedule(name, kind, starts_at, ends_at, location)
  loop
    update rush.events
    set
      kind = scheduled_event.kind,
      status = 'PUBLISHED',
      starts_at = scheduled_event.starts_at,
      ends_at = scheduled_event.ends_at,
      location = scheduled_event.location,
      visibility = 'PUBLIC',
      checkin_opens_at = scheduled_event.starts_at - interval '30 minutes',
      checkin_closes_at = scheduled_event.ends_at,
      updated_at = now()
    where cycle_id = target_cycle_id and lower(name) = lower(scheduled_event.name);

    if not found then
      insert into rush.events (
        cycle_id,
        name,
        kind,
        status,
        starts_at,
        ends_at,
        location,
        visibility,
        checkin_opens_at,
        checkin_closes_at,
        checkin_token_digest
      ) values (
        target_cycle_id,
        scheduled_event.name,
        scheduled_event.kind,
        'PUBLISHED',
        scheduled_event.starts_at,
        scheduled_event.ends_at,
        scheduled_event.location,
        'PUBLIC',
        scheduled_event.starts_at - interval '30 minutes',
        scheduled_event.ends_at,
        encode(extensions.digest(gen_random_uuid()::text || gen_random_uuid()::text, 'sha256'), 'hex')
      );
    end if;
  end loop;
end;
$migration$;
