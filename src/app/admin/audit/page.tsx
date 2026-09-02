import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { formatEasternDateTime } from "@/lib/date-time";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 100;

// rush.audit_events has been written since the first migration and never read
// by a human. Which meant "who moved this applicant to REJECTED, and when?"
// was unanswerable without database access.
//
// Row visibility is already enforced by the audit_events_read_internal policy:
// BOARD and OWNER see everything in their cycle, AUDIT_READ holders see only
// operational resources. This page adds no filtering of its own beyond the
// cycle, so it can never show more than the policy allows.
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ resource?: string; page?: string }>;
}) {
  const [user, { resource, page }] = await Promise.all([requireAdmin(), searchParams]);
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS")) redirect("/admin");
  const pageIndex = Math.max(0, Number.parseInt(page ?? "0", 10) || 0);
  const supabase = await createClient();

  let query = supabase
    .from("audit_events")
    .select("id,actor_id,action,resource,resource_id,metadata,created_at")
    .eq("cycle_id", cycleId)
    .order("created_at", { ascending: false })
    .range(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE);
  if (resource) query = query.eq("resource", resource);
  const { data: rows, error } = await query;
  if (error) throw error;

  // audit_events.actor_id points at auth.users, not rush.profiles, so there is
  // no foreign key for PostgREST to embed across. Resolve names separately and
  // tolerate misses: a profile the reader cannot see must not drop the event.
  const events = (rows ?? []).slice(0, PAGE_SIZE);
  const hasNextPage = (rows ?? []).length > PAGE_SIZE;
  const actorIds = Array.from(new Set(events.map((event) => event.actor_id).filter((id): id is string => Boolean(id))));
  const { data: profiles } = actorIds.length
    ? await supabase.from("profiles").select("id,display_name").in("id", actorIds)
    : { data: [] };
  const actorNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));

  const resources = Array.from(new Set(events.map((event) => event.resource))).sort();
  const pageHref = (index: number) => {
    const params = new URLSearchParams();
    if (resource) params.set("resource", resource);
    if (index > 0) params.set("page", String(index));
    const query = params.toString();
    return query ? `/admin/audit?${query}` : "/admin/audit";
  };

  return (
    <main className="workspace-stack mx-auto flex max-w-6xl flex-col">
      <WorkspaceHeader
        eyebrow="Accountability"
        title="Audit log"
        description="Every recorded action in this cycle, newest first. Entries cannot be edited or deleted."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/audit" />

      <nav aria-label="Filter by resource" className="flex flex-wrap gap-2">
        <Link
          href="/admin/audit"
          aria-current={resource ? undefined : "page"}
          className={`inline-flex min-h-10 items-center rounded-full px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${resource ? "text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]" : "bg-mecg-navy text-white"}`}
        >
          All
        </Link>
        {resources.map((name) => (
          <Link
            key={name}
            href={`/admin/audit?resource=${encodeURIComponent(name)}`}
            aria-current={resource === name ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${resource === name ? "bg-mecg-navy text-white" : "text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]"}`}
          >
            {name}
          </Link>
        ))}
      </nav>

      <section className="flex flex-col gap-2">
        {events.map((event) => (
          <article key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-mecg-navy">
                {event.action.replaceAll("_", " ")}
                <span className="ml-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-mecg-navy/45">{event.resource}</span>
              </p>
              <p className="mt-0.5 truncate text-[12px] text-mecg-navy/55">
                {event.actor_id ? actorNames.get(event.actor_id) ?? "Account removed" : "System"}
                {event.resource_id ? ` · ${event.resource_id}` : ""}
              </p>
            </div>
            <time dateTime={event.created_at} className="font-mono text-[11px] tabular-nums text-mecg-navy/45">
              {formatEasternDateTime(event.created_at)}
            </time>
          </article>
        ))}
        {!events.length && (
          <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-7 text-center text-sm text-mecg-navy/55">
            No audit entries match this view.
          </p>
        )}
      </section>

      {(pageIndex > 0 || hasNextPage) && (
        <nav aria-label="Audit log pages" className="flex items-center justify-between">
          {pageIndex > 0
            ? <Link href={pageHref(pageIndex - 1)} className="button-secondary text-sm">Newer</Link>
            : <span />}
          {hasNextPage && <Link href={pageHref(pageIndex + 1)} className="button-secondary text-sm">Older</Link>}
        </nav>
      )}
    </main>
  );
}
