-- Fresh Supabase projects no longer auto-grant Data API privileges on newly
-- created relations. RLS policies only filter rows after PostgreSQL's table
-- privilege check, so mirror the operations allowed by the existing policies.

grant select, insert, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.invite_allowlist to authenticated;
grant select, insert, update, delete on public.recruitment_cycles to authenticated;
grant select, insert, update, delete on public.candidates to authenticated;
grant select, insert, update, delete on public.application_questions to authenticated;
grant select on public.application_responses to authenticated;
grant select, insert, update on public.rubric_versions to authenticated;
grant select, insert, update on public.rubric_criteria to authenticated;
grant select, insert on public.score_submissions to authenticated;
grant select, insert, update on public.scores to authenticated;
grant select, insert, update on public.notes to authenticated;
grant select, insert, update on public.reactions to authenticated;
grant select, insert, update on public.coi_flags to authenticated;
grant select, insert, update, delete on public.evaluator_assignments to authenticated;
grant select, insert on public.stage_transitions to authenticated;
grant select, insert, update on public.hash_sessions to authenticated;
grant select, insert, delete on public.hash_session_participants to authenticated;
grant select, insert on public.votes to authenticated;
grant select, insert on public.decisions to authenticated;
grant select on public.audit_log to authenticated;
grant select, insert, update, delete on public.placement_features to authenticated;
grant select, insert, update, delete on public.recruitment_events to authenticated;
grant select on public.event_checkins to authenticated;
grant select, update on public.membership_requests to authenticated;

-- Server-only application intake uses the service-role client. It bypasses
-- RLS, but PostgreSQL still requires relation and function privileges.
grant select, insert, update, delete on all tables in schema public to service_role;
grant execute on function public.submit_application(
  uuid, text, uuid, text, text, text, text, text, text, text, jsonb
) to service_role;
grant execute on function public.prune_apply_rate_limit() to service_role;
