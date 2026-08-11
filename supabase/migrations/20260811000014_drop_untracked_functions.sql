-- Remove obsolete local-only functions that were never represented by a
-- checked-in migration and have no application callers. Their supported
-- replacements are the actions/RPCs defined in repository migrations.

drop function if exists public.submit_candidate_scores(
  uuid,
  public.candidate_stage,
  uuid,
  jsonb
);
drop function if exists public.review_membership(uuid, boolean, public.member_role);
drop function if exists public.set_recruitment_cycle_state(uuid, boolean, boolean);
