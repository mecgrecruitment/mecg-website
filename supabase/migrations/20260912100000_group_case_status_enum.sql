-- The board tracks Speed Dating, Group Case, and Interview as separate stages.
-- INVITED already means "enrolled in Speed Dating" (see speed_dating_enrollment)
-- and IN_PROCESS follows it, so one new value between them covers Group Case.
-- Kept in its own migration: a new enum value cannot be referenced by a SQL
-- function created in the same transaction.
alter type rush.application_status add value if not exists 'GROUP_CASE' after 'INVITED';
