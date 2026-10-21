#!/usr/bin/env python3
"""Generate the migration that makes every rush SELECT policy actor-cheap.

Each rush SELECT policy calls SECURITY DEFINER helpers such as
rush.has_cycle_role(cycle_id, roles) once per candidate row. SECURITY DEFINER
blocks inlining, so each call re-parses the JWT, re-reads auth_identities and
re-runs its own lookup for every row. This script reads the policies as the
local database currently has them and rewrites each helper call into a
membership test against a set-returning helper with the same body:

    rush.has_cycle_role(cycle_id, R)  ->  cycle_id in (select rush.actor_cycles_with_role(R))
    rush.actor_id()                   ->  (select rush.actor_id())

An uncorrelated sublink is planned once per statement (an InitPlan or a hashed
SubPlan), so the per-row work becomes a hash probe. Semantics are unchanged
because both sides are SECURITY DEFINER and the set function is the scalar
function with its argument unbound. The one subtlety is NULL: f(NULL) was false,
while `NULL in (non-empty set)` is NULL, so a call under NOT is wrapped in
`coalesce(..., false)`. Elsewhere a policy treats NULL and false alike.

The policy bodies in the output are derived from pg_get_expr on the live
catalog, so run this against a database that has every earlier migration
applied. The generated file is checked in; this script is how a reviewer
regenerates it and diffs.

Usage: generate-migration.py <db-url> <output.sql>
"""

import re
import subprocess
import sys
from pathlib import Path

SET_FUNCTIONS = """\
create or replace function rush.actor_cycles_with_role(allowed_roles rush.member_role[])
returns setof text
language sql
stable
security definer
set search_path = ''
rows 8
as $$
  select m.cycle_id
  from rush.memberships m
  join rush.profiles p on p.id = m.user_id
  where m.user_id = (select rush.actor_id())
    and m.active
    and p.active
    and m.role = any (allowed_roles);
$$;

create or replace function rush.actor_cycles_with_capability(capability text)
returns setof text
language sql
stable
security definer
set search_path = ''
rows 8
as $$
  select m.cycle_id
  from rush.memberships m
  join rush.profiles p on p.id = m.user_id
  join rush.rush_cycles c on c.id = m.cycle_id
  where m.user_id = (select rush.actor_id())
    and m.active
    and p.active
    and (
      m.role in ('BOARD', 'OWNER')
      or (
        m.role::text = 'RECRUITMENT_COMMITTEE'
        and c.status not in ('CLOSED', 'ARCHIVED')
        and capability in ('APPLICANT_OPERATIONS', 'SCREENING_ADMINISTRATION', 'EVENTS', 'CASE_GROUPS', 'CANDIDATE_ACCESS', 'AUDIT_READ')
      )
    );
$$;

create or replace function rush.actor_active_screening_reviewer_cycles()
returns setof text
language sql
stable
security definer
set search_path = ''
rows 4
as $$
  select distinct b.cycle_id
  from rush.screening_reviewers sr
  join rush.screening_batches b on b.id = sr.batch_id
  where sr.reviewer_id = (select rush.actor_id())
    and sr.active
    and b.status = 'PUBLISHED'
    and rush.is_eligible_screening_reviewer(b.cycle_id, (select rush.actor_id()));
$$;

create or replace function rush.actor_conflicted_application_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
rows 8
as $$
  select c.application_id
  from rush.conflict_declarations c
  where c.declarer_id = (select rush.actor_id());
$$;

create or replace function rush.actor_assigned_application_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
rows 64
as $$
  select ea.application_id
  from rush.evaluation_assignments ea
  where ea.evaluator_id = (select rush.actor_id());
$$;

create or replace function rush.actor_owned_application_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
rows 4
as $$
  select a.id
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = (select rush.actor_id());
$$;

create or replace function rush.actor_application_cycle_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
rows 4
as $$
  select a.cycle_id
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = (select rush.actor_id());
$$;

create or replace function rush.actor_readable_colleague_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
rows 128
as $$
  select theirs.user_id
  from rush.profiles actor_profile
  join rush.memberships mine on mine.user_id = actor_profile.id
  join rush.memberships theirs on theirs.cycle_id = mine.cycle_id
  where actor_profile.id = (select rush.actor_id())
    and actor_profile.active
    and mine.active
    and theirs.active
    and (
      mine.role in ('BOARD', 'OWNER')
      or (
        mine.role in ('MEMBER', 'PANEL')
        and not exists (
          select 1
          from rush.memberships committee
          join rush.rush_cycles c on c.id = committee.cycle_id
          where committee.user_id = mine.user_id
            and committee.cycle_id = mine.cycle_id
            and committee.role = 'RECRUITMENT_COMMITTEE'
            and committee.active
            and c.status in ('CLOSED', 'ARCHIVED')
        )
      )
      or (
        mine.role = 'RECRUITMENT_COMMITTEE'
        and mine.cycle_id in (select rush.actor_cycles_with_capability('CANDIDATE_ACCESS'))
      )
    );
$$;

create or replace function rush.actor_managed_application_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
rows 256
as $$
  select a.id
  from rush.applications a
  where a.cycle_id in (select rush.actor_cycles_with_role(array['BOARD','OWNER']::rush.member_role[]));
$$;
"""

GRANTS = """\
revoke all on function rush.actor_cycles_with_role(rush.member_role[]) from public, anon;
revoke all on function rush.actor_cycles_with_capability(text) from public, anon;
revoke all on function rush.actor_active_screening_reviewer_cycles() from public, anon;
revoke all on function rush.actor_conflicted_application_ids() from public, anon;
revoke all on function rush.actor_assigned_application_ids() from public, anon;
revoke all on function rush.actor_owned_application_ids() from public, anon;
revoke all on function rush.actor_application_cycle_ids() from public, anon;
revoke all on function rush.actor_readable_colleague_ids() from public, anon;
revoke all on function rush.actor_managed_application_ids() from public, anon;
grant execute on function rush.actor_cycles_with_role(rush.member_role[]) to authenticated, service_role;
grant execute on function rush.actor_cycles_with_capability(text) to authenticated, service_role;
grant execute on function rush.actor_active_screening_reviewer_cycles() to authenticated, service_role;
grant execute on function rush.actor_conflicted_application_ids() to authenticated, service_role;
grant execute on function rush.actor_assigned_application_ids() to authenticated, service_role;
grant execute on function rush.actor_owned_application_ids() to authenticated, service_role;
grant execute on function rush.actor_application_cycle_ids() to authenticated, service_role;
grant execute on function rush.actor_readable_colleague_ids() to authenticated, service_role;
grant execute on function rush.actor_managed_application_ids() to authenticated, service_role;
"""

BOARD_OWNER = "array['BOARD', 'OWNER']::rush.member_role[]"

# scalar helper -> (arity, how its arguments become a set-membership test)
REWRITES = {
    "has_cycle_role": (2, lambda a: f"{a[0]} in (select rush.actor_cycles_with_role({a[1]}))"),
    "has_cycle_capability": (2, lambda a: f"{a[0]} in (select rush.actor_cycles_with_capability({a[1]}))"),
    "is_active_screening_reviewer": (1, lambda a: f"{a[0]} in (select rush.actor_active_screening_reviewer_cycles())"),
    "actor_has_application_conflict": (1, lambda a: f"{a[0]} in (select rush.actor_conflicted_application_ids())"),
    "actor_is_assigned_evaluator": (1, lambda a: f"{a[0]} in (select rush.actor_assigned_application_ids())"),
    "owns_application": (1, lambda a: f"{a[0]} in (select rush.actor_owned_application_ids())"),
    "actor_has_application_in_cycle": (1, lambda a: f"{a[0]} in (select rush.actor_application_cycle_ids())"),
    "actor_can_read_colleague_profile": (1, lambda a: f"{a[0]} in (select rush.actor_readable_colleague_ids())"),
    "actor_manages_application_cycle": (1, lambda a: f"{a[0]} in (select rush.actor_managed_application_ids())"),
    "actor_id": (0, lambda a: "(select rush.actor_id())"),
}
# Row-local helpers that do not depend on the actor stay as they are.
PASSTHROUGH = {"event_cycle_id"}

# Policies that already evaluate their actor lookup once per statement
# (an uncorrelated EXISTS is an InitPlan). Rewriting them changes nothing.
LEAVE_UNCHANGED = {("projects", "projects_read_internal"), ("project_members", "project_members_read_internal")}

KEYWORDS = {"AND", "OR", "NOT", "EXISTS", "SELECT", "FROM", "WHERE", "JOIN", "ON", "ARRAY", "ANY", "IS", "NULL", "AS", "IN", "DISTINCT"}


def matching_paren(text, open_index):
    depth = 0
    quoted = False
    for i in range(open_index, len(text)):
        ch = text[i]
        if ch == "'":
            quoted = not quoted
        elif not quoted:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    return i
    raise ValueError("unbalanced parentheses")


def split_args(text):
    args, depth, quoted, start = [], 0, False, 0
    for i, ch in enumerate(text):
        if ch == "'":
            quoted = not quoted
        elif not quoted:
            if ch in "([":
                depth += 1
            elif ch in ")]":
                depth -= 1
            elif ch == "," and depth == 0:
                args.append(text[start:i].strip())
                start = i + 1
    tail = text[start:].strip()
    if tail:
        args.append(tail)
    return args


CALL = re.compile(r"(NOT )?rush\.([a-z_]+)\(")


def rewrite(qual):
    out, pos = [], 0
    while True:
        m = CALL.search(qual, pos)
        if not m:
            out.append(qual[pos:])
            return "".join(out)
        name = m.group(2)
        close = matching_paren(qual, m.end() - 1)
        args = [rewrite(a) for a in split_args(qual[m.end():close])]
        out.append(qual[pos:m.start()])
        if name in PASSTHROUGH:
            out.append(f"{m.group(1) or ''}rush.{name}({', '.join(args)})")
        elif name in REWRITES:
            arity, build = REWRITES[name]
            if len(args) != arity:
                raise ValueError(f"rush.{name} called with {len(args)} args")
            test = build(args)
            if m.group(1):
                test = f"not coalesce({test}, false)"
            out.append(test)
        else:
            raise ValueError(f"no rewrite rule for rush.{name}")
        pos = close + 1


def lowercase_keywords(text):
    pieces, quoted, start = [], False, 0
    for i, ch in enumerate(text):
        if ch == "'":
            if quoted:
                pieces.append(text[start:i + 1])
                start = i + 1
            else:
                pieces.append(re.sub(r"\b([A-Z]+)\b", lambda k: k.group(1).lower() if k.group(1) in KEYWORDS else k.group(1), text[start:i]))
                start = i
            quoted = not quoted
    pieces.append(re.sub(r"\b([A-Z]+)\b", lambda k: k.group(1).lower() if k.group(1) in KEYWORDS else k.group(1), text[start:]))
    return "".join(pieces)


def check_rewritten(table, policy, qual):
    leftover = {m.group(1) for m in re.finditer(r"rush\.([a-z_]+)\(", qual)}
    allowed = PASSTHROUGH | {"actor_id"} | {
        "actor_cycles_with_role", "actor_cycles_with_capability", "actor_active_screening_reviewer_cycles",
        "actor_conflicted_application_ids", "actor_assigned_application_ids", "actor_owned_application_ids",
        "actor_application_cycle_ids", "actor_readable_colleague_ids", "actor_managed_application_ids",
    }
    if leftover - allowed:
        raise ValueError(f"{table}.{policy}: unexpected helper calls remain: {leftover - allowed}")
    if re.search(r"(?<!\(select )rush\.actor_id\(\)", qual):
        raise ValueError(f"{table}.{policy}: bare rush.actor_id() remains")
    if re.search(r"\bnot \w+ in \(select", qual):
        raise ValueError(f"{table}.{policy}: NOT over a membership test without coalesce")


def fetch_policies(db_url):
    sql = """
      select tablename, policyname, array_to_string(roles, ','), qual
      from pg_policies where schemaname = 'rush' and cmd = 'SELECT' order by tablename, policyname
    """
    raw = subprocess.run(
        ["psql", db_url, "-At", "-F", "\x1f", "-R", "\x1e", "-c", sql],
        check=True, capture_output=True, text=True,
    ).stdout
    return [tuple(r.split("\x1f")) for r in raw.split("\x1e") if r.strip()]


def main(db_url, output):
    policies = fetch_policies(db_url)
    if len(policies) < 40:
        raise SystemExit(f"only {len(policies)} SELECT policies found; is every migration applied?")
    body = [
        "-- Row-level security SELECT policies that compute actor-dependent facts once\n"
        "-- per statement instead of once per row.\n"
        "--\n"
        "-- Every rush SELECT policy used to call SECURITY DEFINER helpers per candidate\n"
        "-- row (has_cycle_role, owns_application, actor_has_application_conflict and so\n"
        "-- on), each re-running rush.actor_id() and its own lookup. SECURITY DEFINER\n"
        "-- blocks inlining, so nothing was shared across rows: a Board listing of 260\n"
        "-- applications with pnm names cost 455 ms and 18,030 buffer hits on production.\n"
        "--\n"
        "-- Each helper call f(x) below is replaced by `x in (select S_f())` where S_f is\n"
        "-- the same SECURITY DEFINER predicate with its argument unbound, and bare\n"
        "-- rush.actor_id() by (select rush.actor_id()). Postgres plans an uncorrelated\n"
        "-- sublink once per statement (InitPlan or hashed SubPlan), so each row costs a\n"
        "-- hash probe. f(NULL) was false while `NULL in (non-empty set)` is NULL, so a\n"
        "-- call under NOT is wrapped in coalesce(..., false). Every set is NULL-free\n"
        "-- (each selected column is NOT NULL). Direct table references inside policy\n"
        "-- subqueries keep their shape so the nested RLS still applies as before.\n"
        "--\n"
        "-- The scalar helpers stay: RPC functions and storage policies still call them.\n"
        "--\n"
        "-- Generated by scripts/rls-initplan/generate-migration.py from the live\n"
        "-- catalog of the preceding migrations. Equivalence is proven by\n"
        "-- scripts/rls-initplan/verify-equivalence.sh.\n\n",
        SET_FUNCTIONS, "\n", GRANTS, "\n",
    ]
    rewritten = 0
    for table, policy, roles, qual in policies:
        if (table, policy) in LEAVE_UNCHANGED:
            continue
        new_qual = lowercase_keywords(rewrite(qual))
        check_rewritten(table, policy, new_qual)
        if new_qual == lowercase_keywords(qual):
            raise ValueError(f"{table}.{policy}: nothing rewritten")
        rewritten += 1
        body.append(
            f"drop policy if exists {policy} on rush.{table};\n"
            f"create policy {policy} on rush.{table}\n"
            f"for select to {roles}\n"
            f"using (\n  {new_qual}\n);\n\n"
        )
    Path(output).write_text("".join(body).rstrip() + "\n")
    print(f"rewrote {rewritten} of {len(policies)} SELECT policies into {output}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
