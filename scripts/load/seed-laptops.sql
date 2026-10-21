-- Load-test fixture for scripts/load/hash-poll.mjs, applied on top of
-- scripts/rls-initplan/seed.sql in a LOCAL database only.
-- 1000 members of c_open, each with a sign-in identity, and a Group Case hash
-- open on c_open with 200 applicants on the ballot and one being presented.
insert into rush.profiles (id, display_name)
select ('00000000-0000-4000-c000-' || lpad(g::text, 12, '0'))::uuid, 'Laptop ' || g
from generate_series(1, 1000) g;

insert into rush.auth_identities (issuer, subject, app_user_id)
select 'https://load.invalid', ('00000000-0000-4000-c000-' || lpad(g::text, 12, '0')), ('00000000-0000-4000-c000-' || lpad(g::text, 12, '0'))::uuid
from generate_series(1, 1000) g;

insert into rush.memberships (id, user_id, cycle_id, role)
select 'load-mem-' || g, ('00000000-0000-4000-c000-' || lpad(g::text, 12, '0'))::uuid, 'c_open', 'MEMBER'
from generate_series(1, 1000) g;

update rush.applications set status = 'GROUP_CASE'
where id in (select id from rush.applications where cycle_id = 'c_open' and status not in ('DRAFT', 'WITHDRAWN') order by id limit 200);

update rush.rush_cycles
set hash_stage = 'GROUP_CASE',
    hash_presenting_application_id = (select id from rush.applications where cycle_id = 'c_open' and status = 'GROUP_CASE' order by id limit 1)
where id = 'c_open';

\copy (select json_agg(json_build_object('iss', 'https://load.invalid', 'sub', subject)) from rush.auth_identities where issuer = 'https://load.invalid') to '/tmp/load-users.json'
