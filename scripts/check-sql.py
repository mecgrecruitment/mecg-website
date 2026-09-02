#!/usr/bin/env python3
"""Validate the database layer without a database.

A migration with a syntax error is only discovered when it is applied, which on
this project means discovering it against a real database. libpg_query is the
parser Postgres itself uses, so this catches the same errors without one.

Two passes, because they cover different things:

  parse_sql      statement level. Catches a truncated statement, bad DDL, an
                 unbalanced paren. Treats a function body as an opaque string.
  parse_plpgsql  the bodies. Nearly all the logic in this schema lives inside
                 SECURITY DEFINER plpgsql functions, so without this pass the
                 riskiest code is the only code not checked.

Migration filenames are also checked for duplicate 14-digit versions. Supabase
uses that prefix as the migration identity, so two otherwise valid SQL files
with the same prefix cannot be released safely.

What this does not do: it is a parser, not a database. It will not catch a
missing column, a wrong type, or a policy that does not do what it claims.
Those still need `npm run test:supabase` against a real project.

Run it with `npm run check:sql` (needs `pip3 install pglast`).

This check is wired into `.github/workflows/ci.yml` after `pglast` is installed.
"""

import re
import sys
from pathlib import Path

try:
    from pglast import parse_plpgsql, parse_sql
except ImportError:
    print("pglast is not installed. Run: pip3 install pglast", file=sys.stderr)
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parent.parent
TARGETS = sorted(ROOT.glob("supabase/migrations/*.sql")) + sorted(ROOT.glob("supabase/tests/*.sql"))


def migration_version_problems(root: Path):
    """Reject migration identities that Supabase cannot distinguish."""
    by_version = {}
    for path in sorted(root.glob("supabase/migrations/*.sql")):
        match = re.match(r"^(\d{14})_.*\.sql$", path.name)
        if match:
            by_version.setdefault(match.group(1), []).append(path.name)
    return [
        f"duplicate migration version {version}: {', '.join(names)}"
        for version, names in sorted(by_version.items())
        if len(names) > 1
    ]


def sql_surface(root: Path):
    """Function and table names the migrations actually define."""
    sql = "\n".join(p.read_text() for p in sorted(root.glob("supabase/migrations/*.sql")))
    functions = set(re.findall(r"create (?:or replace )?function rush\.([a-z_][a-z0-9_]*)", sql))
    tables = set(re.findall(r"create table (?:if not exists )?rush\.([a-z_][a-z0-9_]*)", sql))
    return functions, tables


def typescript_usage(root: Path):
    """RPCs and tables the app calls, and what database.types.ts declares."""
    sources = [p for p in list(root.glob("src/**/*.ts")) + list(root.glob("src/**/*.tsx"))
               if not p.name.endswith(".test.ts")]
    text = "\n".join(p.read_text() for p in sources)
    rpcs = set(re.findall(r'\.rpc\(\s*"([a-z_]+)"', text))
    # supabase.storage.from() names a bucket, not a table. Strip those calls
    # first rather than using a lookbehind: a lookbehind has to be fixed width,
    # so it misses the perfectly normal case of .storage and .from being split
    # across lines.
    without_storage = re.sub(r'\.storage\s*\.from\(\s*"[a-z_]+"', "", text)
    tables = set(re.findall(r'\.from\(\s*"([a-z_]+)"', without_storage))

    types = (root / "src/lib/supabase/database.types.ts").read_text()
    fn_block = re.search(r"\n    Functions: \{\n(.*?)\n    \}\n", types, re.S)
    declared_fns = set(re.findall(r"^      ([a-z_][a-z0-9_]*):", fn_block.group(1), re.M)) if fn_block else set()
    tbl_block = re.search(r"\n    Tables: \{\n(.*?)\n    \}\n    Views:", types, re.S)
    declared_tbls = set(re.findall(r"^      ([a-z_][a-z0-9_]*): \{", tbl_block.group(1), re.M)) if tbl_block else set()
    return rpcs, tables, declared_fns, declared_tbls


def check_contract(root: Path):
    """database.types.ts is hand-maintained between `supabase gen types` runs, so
    it can drift from the migrations silently. Nothing else catches that: a
    wrong name typechecks against the hand-written type and fails at runtime.

    Only exact-name checks live here. Comparing argument names as well was tried
    and produced five false positives out of five, because shorthand properties,
    ternary colons and defaulted parameters all confuse a regex. A check that
    cries wolf gets ignored.
    """
    functions, tables = sql_surface(root)
    rpcs, used_tables, declared_fns, declared_tbls = typescript_usage(root)
    problems = []
    for name in sorted(rpcs - functions):
        problems.append(f'rpc("{name}") is called but no migration defines rush.{name}')
    for name in sorted(rpcs - declared_fns):
        problems.append(f'rpc("{name}") is called but database.types.ts does not declare it')
    for name in sorted(used_tables - tables):
        problems.append(f'from("{name}") is used but no migration defines rush.{name}')
    for name in sorted(used_tables - declared_tbls):
        problems.append(f'from("{name}") is used but database.types.ts does not declare it')
    for name in sorted(declared_fns - functions):
        problems.append(f"database.types.ts declares rush.{name}, which no migration defines")
    return problems, len(rpcs), len(used_tables)


def main() -> int:
    if not TARGETS:
        print("No SQL files found under supabase/", file=sys.stderr)
        return 2

    failures = migration_version_problems(ROOT)
    bodies = 0
    for path in TARGETS:
        name = path.relative_to(ROOT)
        text = path.read_text()
        try:
            parse_sql(text)
        except Exception as error:
            failures.append(f"{name}: {error}")
            continue
        if "language plpgsql" in text.lower():
            try:
                bodies += len(parse_plpgsql(text))
            except Exception as error:
                failures.append(f"{name} (function body): {error}")

    contract, rpc_count, table_count = check_contract(ROOT)
    failures.extend(contract)

    for failure in failures:
        print(f"FAIL {failure}", file=sys.stderr)

    print(f"Parsed {len(TARGETS)} SQL files and {bodies} function bodies.")
    print(f"Checked {rpc_count} RPC names and {table_count} table names against the migrations and the generated types.")
    if failures:
        print(f"{len(failures)} problem(s) found.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
