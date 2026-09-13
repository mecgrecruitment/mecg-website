-- Removes the Speed Dating assignments that advance_to_speed_dating auto-staffed
-- before members started grading themselves: untouched (no evaluation, no group
-- claim) rows only, so they stop showing as open forms in members' queues.
delete from rush.evaluation_assignments ea
using rush.rounds r
where r.id = ea.round_id
  and r.kind = 'SPEED_DATING'
  and r.cycle_id = 'ebba6e7a-ccad-4e45-9716-44bb2b9d5d10'
  and ea.status = 'ASSIGNED'
  and not exists (select 1 from rush.evaluations e where e.assignment_id = ea.id)
  and not exists (
    select 1
    from rush.speed_dating_pair_claims c
    join rush.speed_dating_pairs p on p.id = c.pair_id
    join rush.speed_dating_pair_members pm on pm.pair_id = p.id and pm.application_id = ea.application_id
    where p.round_id = ea.round_id and c.evaluator_id = ea.evaluator_id
  );

select ea.status, count(*)
from rush.evaluation_assignments ea
join rush.rounds r on r.id = ea.round_id
where r.kind = 'SPEED_DATING'
  and r.cycle_id = 'ebba6e7a-ccad-4e45-9716-44bb2b9d5d10'
group by ea.status
order by ea.status;
