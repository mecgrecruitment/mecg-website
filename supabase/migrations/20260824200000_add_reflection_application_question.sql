create or replace function rush.seed_cycle_questions(target_cycle_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into rush.application_questions (cycle_id, key, prompt, input_type, required, sort_order)
  values
    (target_cycle_id, 'why_mecg', 'Why MECG, and what do you hope to contribute or learn here?', 'long_text', true, 0),
    (target_cycle_id, 'problem_example', 'Describe a messy problem you helped structure. What was your role, what did you do, and what changed?', 'long_text', true, 1),
    (target_cycle_id, 'feedback_example', 'Tell us about a time feedback or disagreement changed your approach.', 'long_text', true, 2)
  on conflict (cycle_id, key) do update set prompt = excluded.prompt, input_type = excluded.input_type, required = excluded.required, sort_order = excluded.sort_order;
end;
$$;
do $migration$
declare cycle_id text;
begin
  for cycle_id in select id from rush.rush_cycles loop
    perform rush.seed_cycle_questions(cycle_id);
  end loop;
end;
$migration$;
