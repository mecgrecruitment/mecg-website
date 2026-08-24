import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import LogoutButton from "@/components/logout-button";
import BoardNav from "./board-nav";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function RoundBoardPage({ kind, title, nav }: { kind: string; title: string; nav: string }) {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE") ?? selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS");
  if (!cycleId) redirect("/member");
  const supabase = await createClient();
  const { data: cycle } = await supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single();
  if (!cycle) redirect("/member");
  const { data: round, error } = await supabase
    .from("rounds")
    .select("id,name,status,kind,evaluation_assignments(id,status,evaluator_id,applications(id,pnms(name)),evaluations(status))")
    .eq("cycle_id", cycleId)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  const canManage = hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");
  const assignments = round?.evaluation_assignments ?? [];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-mecg-orange-ink">{cycle.name} · {cycle.status}</p>
          <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">{title}</h1>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/member" className="button-secondary text-sm">Evaluation Hub</Link>
          <LogoutButton />
        </div>
      </header>
      <BoardNav current={nav} />
      {!round ? (
        <div className="rounded-xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-center">
          <p className="text-[13px] text-mecg-navy/40">This cycle does not have a {title} round yet.</p>
        </div>
      ) : (
        <section className="rounded-xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm text-mecg-navy/55">
              Round status: {round.status}. {canManage ? "Use Pipeline ops to publish, activate, and freeze." : null}
            </p>
            <p className="font-mono text-xs text-mecg-navy/50">
              {assignments.length} assignment{assignments.length === 1 ? "" : "s"} in this round
            </p>
          </div>
          {assignments.length === 0 ? (
            <div className="mt-4 rounded-xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-center">
              <p className="text-[13px] text-mecg-navy/40">No assignments yet</p>
            </div>
          ) : (
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-mecg-navy/10">
                  <th className="py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Applicant</th>
                  <th className="py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Assignment</th>
                  <th className="py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Evaluation</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => {
                  const applicantName = Array.isArray(assignment.applications)
                    ? "Applicant"
                    : assignment.applications?.pnms && !Array.isArray(assignment.applications.pnms)
                      ? assignment.applications.pnms.name
                      : "Applicant";
                  const submitted = assignment.evaluations.some((evaluation) => ["SUBMITTED", "LOCKED"].includes(evaluation.status));
                  return (
                    <tr key={assignment.id} className="border-b border-mecg-navy/10">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-mecg-navy font-mono text-[10px] font-semibold text-white">
                            {initials(applicantName)}
                          </span>
                          <span className="text-[13px] font-semibold text-mecg-navy">{applicantName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-[13px] text-mecg-navy/55">{assignment.status}</td>
                      <td className="py-2.5">
                        <span
                          className={
                            submitted
                              ? "inline-flex items-center rounded-full bg-mecg-navy/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-mecg-navy"
                              : "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold text-mecg-navy/50 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)]"
                          }
                        >
                          {submitted ? "Submitted" : "Open"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  );
}
