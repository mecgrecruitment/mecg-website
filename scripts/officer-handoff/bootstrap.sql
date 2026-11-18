-- Runs after the member-tools bootstrap and migration, which supply profiles,
-- memberships, cycles, audit events and member_tool_reviewers. Cycles need a
-- name for the access list.
alter table rush.rush_cycles add column name text;
