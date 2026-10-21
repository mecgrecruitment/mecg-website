-- Screening exclusion ignores batch status; a reviewer on a DRAFT batch would lose candidate access.
create or replace function rush.actor_active_screening_reviewer_cycles()
returns setof text language sql stable security definer set search_path = '' as $$
  select distinct b.cycle_id
  from rush.screening_reviewers sr
  join rush.screening_batches b on b.id = sr.batch_id
  where sr.reviewer_id = (select rush.actor_id()) and sr.active
    and rush.is_eligible_screening_reviewer(b.cycle_id, (select rush.actor_id()));
$$;
