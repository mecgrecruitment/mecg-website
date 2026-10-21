-- Harness functions. Runs as postgres after seed.sql.
--
-- harness.capture(phase) records, for every identity in harness.identities and
-- every rush table with a SELECT policy, the primary keys that identity can
-- see, by switching role and JWT claims exactly as PostgREST would.
\set ON_ERROR_STOP on

create schema if not exists harness;
create table if not exists harness.visible (phase text not null, label text not null, tbl text not null, pk text);

drop table if exists harness.tables;
create table harness.tables as
select c.relname as tbl,
  'concat_ws('','', ' || string_agg(format('%I::text', a.attname), ', ' order by a.attnum) || ')' as pkexpr
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_index i on i.indrelid = c.oid and i.indisprimary
join pg_attribute a on a.attrelid = c.oid and a.attnum = any (i.indkey)
where n.nspname = 'rush'
  and c.relname in (select tablename from pg_policies where schemaname = 'rush' and cmd = 'SELECT')
group by c.relname;

do $$
begin
  if (select count(*) from harness.tables) <> (select count(distinct tablename) from pg_policies where schemaname = 'rush' and cmd = 'SELECT') then
    raise exception 'a table with a SELECT policy has no primary key; the harness cannot identify its rows';
  end if;
end $$;

create or replace function harness.capture(phase text)
returns void
language plpgsql
as $$
declare
  ident record;
  t record;
  seen text[];
begin
  delete from harness.visible v where v.phase = capture.phase;
  for ident in select label, db_role, claims from harness.identities order by label loop
    for t in select tbl, pkexpr from harness.tables order by tbl loop
      begin
        execute format('set local role %I', ident.db_role);
        perform set_config('request.jwt.claims', ident.claims, true);
        execute format('select coalesce(array_agg(%s order by 1), ''{}'') from rush.%I', t.pkexpr, t.tbl) into seen;
        reset role;
      exception when others then
        reset role;
        seen := array['ERROR ' || sqlstate];
      end;
      if cardinality(seen) = 0 then
        insert into harness.visible (phase, label, tbl, pk) values (capture.phase, ident.label, t.tbl, null);
      else
        insert into harness.visible (phase, label, tbl, pk) select capture.phase, ident.label, t.tbl, unnest(seen);
      end if;
    end loop;
  end loop;
end
$$;

create or replace function harness.diff(a text, b text)
returns table (label text, tbl text, pk text, only_in text)
language sql
as $$
  (select v.label, v.tbl, v.pk, a from harness.visible v where v.phase = a
   except select v.label, v.tbl, v.pk, a from harness.visible v where v.phase = b)
  union all
  (select v.label, v.tbl, v.pk, b from harness.visible v where v.phase = b
   except select v.label, v.tbl, v.pk, b from harness.visible v where v.phase = a)
$$;

create or replace function harness.diff_count(a text, b text)
returns bigint
language sql
as $$ select count(*) from harness.diff(a, b) $$;

-- How many distinct visible sets each table produces across the identities,
-- and the smallest and largest of them. One distinct view would mean the table
-- cannot tell the identities apart and so cannot detect a broken policy.
create or replace function harness.discrimination()
returns table (tbl text, distinct_views bigint, min_rows bigint, max_rows bigint, identities_seeing_rows bigint)
language sql
as $$
  select s.tbl, count(distinct s.sig), min(s.n), max(s.n), count(*) filter (where s.n > 0)
  from (
    select v.tbl, v.label, count(v.pk) as n, md5(coalesce(string_agg(v.pk, ',' order by v.pk), '')) as sig
    from harness.visible v where v.phase = 'old'
    group by v.tbl, v.label
  ) s
  group by s.tbl
$$;
