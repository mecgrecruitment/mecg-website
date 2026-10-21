-- Screening exclusion ignores reviewer eligibility; an ineligible reviewer would lose their assigned applicants.
create or replace function rush.actor_active_screening_reviewer_cycles()
returns setof text language sql stable security definer set search_path = '' as $$
  select distinct b.cycle_id
  from rush.screening_reviewers sr
  join rush.screening_batches b on b.id = sr.batch_id
  where sr.reviewer_id = (select rush.actor_id()) and sr.active and b.status = 'PUBLISHED';
$$;
