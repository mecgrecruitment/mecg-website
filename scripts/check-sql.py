#!/usr/bin/env python3
"""Parse every migration and database test with Postgres' own parser.

A migration with a syntax error is only discovered when it is applied, which on
this project means discovering it against a real database. libpg_query is the
parser Postgres itself uses, so this catches the same errors without one.

Two passes, because they cover different things:

  parse_sql      statement level. Catches a truncated statement, bad DDL, an
                 unbalanced paren. Treats a function body as an opaque string.
  parse_plpgsql  the bodies. Nearly all the logic in this schema lives inside
                 SECURITY DEFINER plpgsql functions, so without this pass the
                 riskiest code is the only code not checked.

What this does not do: it is a parser, not a database. It will not catch a
missing column, a wrong type, or a policy that does not do what it claims.
Those still need `npm run test:supabase` against a real project.
"""

import sys
from pathlib import Path

try:
    from pglast import parse_plpgsql, parse_sql
except ImportError:
    print("pglast is not installed. Run: pip3 install pglast", file=sys.stderr)
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parent.parent
TARGETS = sorted(ROOT.glob("supabase/migrations/*.sql")) + sorted(ROOT.glob("supabase/tests/*.sql"))


def main() -> int:
    if not TARGETS:
        print("No SQL files found under supabase/", file=sys.stderr)
        return 2

    failures = []
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

    for failure in failures:
        print(f"FAIL {failure}", file=sys.stderr)

    print(f"Parsed {len(TARGETS)} SQL files and {bodies} function bodies.")
    if failures:
        print(f"{len(failures)} file(s) failed to parse.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
