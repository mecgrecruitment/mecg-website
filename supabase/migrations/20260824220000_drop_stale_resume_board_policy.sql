-- storage_resumes_board_select granted SELECT on every object in the
-- resumes bucket to anyone with public.members.role = 'board' (the
-- abandoned Phase-0 schema), unscoped by path or cycle. The correctly
-- scoped rush-schema policy (storage_resumes_board_select_rush) already
-- covers legitimate board/owner resume access with conflict-of-interest
-- checks, so this stale policy is a pure leak, not a needed grant.
drop policy if exists storage_resumes_board_select on storage.objects;
