# ERRORS

Log of approaches that took 2+ attempts. Check this before suggesting approaches to similar tasks.

## Supabase grants for public views
Failed: granting SELECT on public views (v_team_public) in the views migration, then running `revoke all on all tables in schema public from anon` in the later RLS migration — the blanket revoke strips view grants too (Postgres treats views as tables for ACLs), so anon got "permission denied for view v_team_public".
Worked: re-granting the intentionally-public views immediately after the blanket revoke, in the same (RLS) migration.
Note: any future blanket REVOKE migration must re-assert every anon-facing view grant after it.

## Supabase CLI on colima (macOS)
Failed: default `supabase start` — the `supabase_vector` logging container can't mount `~/.colima/default/docker.sock` (mkdir: operation not supported).
Worked: `[analytics] enabled = false` in supabase/config.toml (drops vector/logflare entirely).
Note: applies to any Docker runtime without a standard socket path.
