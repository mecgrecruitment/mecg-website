# MECG data retention

Status: policy blocked

The Board and the appropriate University privacy office must approve retention periods before engineering adds automated deletion. Code must not guess these periods.

## Data classes that need a decision

| Data | Current storage | Policy decision |
| --- | --- | --- |
| Applications and profile fields | Supabase PostgreSQL | Retention period after cycle close |
| Resumes | Private Supabase Storage | Retention period and legal hold process |
| Evaluation ratings and notes | Supabase PostgreSQL | Retention period and correction policy |
| Decisions and approvals | Supabase PostgreSQL | Retention period and required archive |
| Audit events | Supabase PostgreSQL | Minimum retention period |
| Rate-limit records | Supabase PostgreSQL | Short operational retention |
| Notification delivery metadata | Supabase PostgreSQL | Retention after final delivery |

## Required controls

- Define a retention period for each data class.
- Define who may place and remove a legal or policy hold.
- Delete storage objects before retiring their database records.
- Record aggregate deletion counts without recording deleted content.
- Test deletion against an isolated project.
- Give the Board a report after each cycle cleanup.

## Exit criteria

- The Board and privacy owner approve every period.
- Automated cleanup uses the approved cycle-close date.
- A hold prevents deletion.
- A retry remains safe after a partial storage failure.
- Tests prove that deleted applicant data is no longer readable.
