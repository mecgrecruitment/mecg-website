# SQLite migration report

The legacy database at `prisma/dev.db` was inspected before Prisma removal. It contained zero users, cycles, applicants, applications, evaluations, and events. No production or local business records required import.

Verified query:

```sql
select 'User', count(*) from User
union all select 'RushCycle', count(*) from RushCycle
union all select 'Pnm', count(*) from Pnm
union all select 'Application', count(*) from Application
union all select 'Evaluation', count(*) from Evaluation
union all select 'Event', count(*) from Event;
```

Every count returned zero. The MECG Recruitment Supabase project already held one Auth-linked member and no recruitment cycles or candidates before the new `rush` schema was introduced. The Supabase migration ledger is therefore the complete source of truth after cutover.
