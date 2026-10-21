import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { selectWorkspaceMembership, requestedWorkspaceCycleId } from "@/lib/workspace-cycle";
import Link from "@/components/workspace-link";
import { requireMember } from "@/lib/auth";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { screeningRpc, type ScreeningQueueItem } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import SectionLabel from "@/components/section-label";
import StatusPill from "@/components/status-pill";
import { assignmentStatusLabel } from "@/lib/labels";
import { parseScreeningProgress, screeningDeadlineLabel } from "./screening-draft";

function statusTone(status: ScreeningQueueItem["assignment_status"]) {
  if (status === "ASSIGNED") return "orange" as const;
  if (status === "RECUSED") return "neutral" as const;
  return "navy" as const;
}

export default async function ScreeningQueuePage() {
  const user = await requireMember();
  const cycle = await selectWorkspaceMembership(user, ["RECRUITMENT_COMMITTEE", "BOARD", "OWNER"]);
  const cycleId = cycle?.cycleId ?? await requestedWorkspaceCycleId();
  if (!cycle) return <main className="mx-auto max-w-3xl p-8"><p className="text-muted">You are not enrolled as an application reviewer.</p></main>;
  const supabase = await createClient();
  const [{ data: queue, error }, { data: rawContext, error: contextError }] = await Promise.all([
    screeningRpc<ScreeningQueueItem[]>(supabase, "my_screening_queue", { target_cycle_id: cycle.cycleId }),
    screeningRpc<unknown>(supabase, "screening_reviewer_context", { target_cycle_id: cycle.cycleId }),
  ]);
  if (error) throw new Error(error.message);
  if (contextError) throw new Error(contextError.message);
  const context = parseScreeningProgress(rawContext);
  if (!context) throw new Error("Screening progress is unavailable");
  const remaining = (queue ?? []).filter((item) => item.assignment_status === "ASSIGNED");
  const [nextApplication, ...laterApplications] = remaining;
  const completion = context.total > 0 ? Math.round((context.completed / context.total) * 100) : 100;
  return (
    <main className="workspace-stack mx-auto flex max-w-4xl flex-col">
      <WorkspaceHeader
        eyebrow={cycle.cycle.name}
        title="Application review"
        description="Review only the evidence in each application. You cannot see who wrote it, so do not try to identify applicants or discuss assignments with other reviewers."
      />
      <WorkspaceNav user={user} cycleId={cycle.cycleId} current="/member/screening" />
      <section className="queue-progress grid gap-3 rounded-xl bg-mecg-navy p-5 text-white sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-sm text-white/70">Your private progress</p>
          <p className="mt-1 text-2xl font-semibold">{context.completed} of {context.total} complete</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true"><div className="h-full rounded-full bg-mecg-orange" style={{ width: `${completion}%` }} /></div>
        </div>
        <p className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold">{screeningDeadlineLabel(context.deadline)}</p>
      </section>
      <section>
        <SectionLabel number="01">Your reading queue</SectionLabel>
        <p className="mt-2 text-sm text-muted">Open one application at a time. Submitted reviews are locked and removed from this list.</p>
        <div className="mt-3.5 space-y-4">
          {nextApplication && (
            <article className="queue-ticket flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5 inset-ring inset-ring-line">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-mecg-orange-ink">Up next</p>
                <p className="queue-ticket-code">{nextApplication.candidate_code}</p>
              </div>
              <Link href={withWorkspaceCycle(`/member/screening/${nextApplication.assignment_id}`, cycleId)} className="button-primary">Continue application</Link>
            </article>
          )}
          {laterApplications.length > 0 && (
            <details className="rounded-xl inset-ring inset-ring-line">
              <summary className="min-h-11 cursor-pointer list-none px-5 py-4 font-semibold">View {laterApplications.length} later {laterApplications.length === 1 ? "application" : "applications"}</summary>
              <div className="divide-y divide-line px-5 pb-3">
                {laterApplications.map((item) => (
                  <article key={item.assignment_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <p className="font-mono text-xs text-muted">{item.candidate_code}</p>
                      <StatusPill tone={statusTone(item.assignment_status)}>{assignmentStatusLabel(item.assignment_status)}</StatusPill>
                    </div>
                    <Link href={withWorkspaceCycle(`/member/screening/${item.assignment_id}`, cycleId)} className="button-secondary text-sm">Open</Link>
                  </article>
                ))}
              </div>
            </details>
          )}
          {!remaining.length && <div className="queue-clear"><p className="queue-clear-title">Queue clear</p><p>You are caught up. No applications are waiting for review.</p></div>}
        </div>
      </section>
    </main>
  );
}
