do $migration$
declare
  target_cycle_id text;
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
    opens_at = make_timestamptz(2026, 9, 2, 20, 0, 0, 'America/Detroit'),
    updated_at = now()
  where id = target_cycle_id;
end;
$migration$;
