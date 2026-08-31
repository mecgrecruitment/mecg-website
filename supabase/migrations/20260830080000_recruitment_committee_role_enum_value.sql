-- Split out from 20260830090000_recruitment_committee_role.sql: Postgres forbids using a
-- new enum value in the same transaction that adds it (SQLSTATE 55P04), and each migration
-- file runs in its own transaction, so this must land in an earlier migration.
alter type rush.member_role add value if not exists 'RECRUITMENT_COMMITTEE';
