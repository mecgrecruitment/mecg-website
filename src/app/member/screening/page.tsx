import Link from "next/link";
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
  const cycle = user.memberships.find((membership) => membership.active && membership.role === "RECRUITMENT_COMMITTEE");
  if (!cycle) return <main className="mx-auto max-w-3xl p-8"><p className="text-mecg-navy/55">You are not enrolled as an application reviewer.</p></main>;
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
      <section className="grid gap-3 rounded-2xl bg-mecg-navy p-5 text-white sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-sm text-white/65">Your private progress</p>
          <p className="mt-1 text-2xl font-semibold">{context.completed} of {context.total} complete</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true"><div className="h-full rounded-full bg-mecg-orange" style={{ width: `${completion}%` }} /></div>
        </div>
        <p className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold">{screeningDeadlineLabel(context.deadline)}</p>
      </section>
      <section>
        <SectionLabel number="01">Your reading queue</SectionLabel>
        <p className="mt-2 text-sm text-mecg-navy/60">Open one application at a time. Submitted reviews are locked and removed from this list.</p>
        <div className="mt-3.5 space-y-4">
          {nextApplication && (
            <article className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-mecg-orange-ink">Up next</p>
                <p className="mt-1 font-mono text-sm text-mecg-navy/65">{nextApplication.candidate_code}</p>
              </div>
              <Link href={`/member/screening/${nextApplication.assignment_id}`} className="button-primary">Continue application</Link>
            </article>
          )}
          {laterApplications.length > 0 && (
            <details className="rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
              <summary className="min-h-11 cursor-pointer list-none px-5 py-4 font-semibold">View {laterApplications.length} later {laterApplications.length === 1 ? "application" : "applications"}</summary>
              <div className="divide-y divide-mecg-navy/10 px-5 pb-3">
                {laterApplications.map((item) => (
                  <article key={item.assignment_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <p className="font-mono text-xs text-mecg-navy/60">{item.candidate_code}</p>
                      <StatusPill tone={statusTone(item.assignment_status)}>{assignmentStatusLabel(item.assignment_status)}</StatusPill>
                    </div>
                    <Link href={`/member/screening/${item.assignment_id}`} className="button-secondary text-sm">Open</Link>
                  </article>
                ))}
              </div>
            </details>
          )}
          {!remaining.length && <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-mecg-navy/55">You are caught up. No applications are waiting for review.</p>}
        </div>
      </section>
    </main>
  );
}
