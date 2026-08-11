-- Resolve Supabase advisor warnings for trigger functions that previously
-- inherited the caller's search_path. All application relations remain schema
-- qualified; pg_catalog is first so built-ins cannot be shadowed.
alter function public.fn_set_updated_at()
  set search_path = pg_catalog, public;

alter function public.fn_deny_mutation()
  set search_path = pg_catalog, public;

alter function public.fn_assign_per_cycle_seq()
  set search_path = pg_catalog, public;

-- The curated definer-rights views in migrations 6 and 10 are intentional.
-- They are the only granted surfaces over otherwise inaccessible base tables
-- and explicitly filter safe columns/rows for anon or authenticated callers.
-- Converting them to security_invoker would break public team/placement/event
-- reads, general-member roster access, and blind scoring aggregates.
