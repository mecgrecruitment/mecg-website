import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import LogoutButton from "@/components/logout-button";
import BoardNav from "./board-nav";
import RoundAssignmentForm from "./round-assignment-form";

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
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS") ?? selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS");
  if (!cycleId) redirect("/member");
  const canOperate = hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS");
  const canHash = hasPermission(user.memberships, cycleId, "HASH_PANEL_ACCESS");
  const supabase = await createClient();
  const { data: cycle, error: cycleError } = await supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single();
  if (cycleError) throw cycleError;
  if (!cycle) redirect("/member");
  const [roundResult, applicationsResult, membersResult, groupMembersResult] = await Promise.all([
    supabase
      .from("rounds")
      .select("id,name,status,kind,evaluation_assignments(id,status,evaluator_id,applications(id,pnms(name)),evaluator:profiles(display_name))")
      .eq("cycle_id", cycleId)
      .eq("kind", kind)
      .maybeSingle(),
    supabase.from("applications").select("id,status,pnms!inner(name)").eq("cycle_id", cycleId),
    supabase.from("memberships").select("user_id,profiles!inner(display_name)").eq("cycle_id", cycleId).eq("active", true),
    kind === "GROUP_CASE"
      ? supabase.from("case_group_members").select("application_id,case_groups!inner(cycle_id,name)").eq("case_groups.cycle_id", cycleId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [roundResult, applicationsResult, membersResult, groupMembersResult]) if (result.error) throw result.error;
  const round = roundResult.data;
  const canManage = hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");
  const assignments = canOperate ? round?.evaluation_assignments ?? [] : [];
  const activeApplications = (applicationsResult.data ?? [])
    .filter((application) => !["DRAFT", "WITHDRAWN", "REJECTED", "WAITLISTED", "OFFERED"].includes(application.status))
    .sort((a, b) => a.pnms.name.localeCompare(b.pnms.name));
  const evaluatorOptions = Array.from(new Map((membersResult.data ?? []).map((member) => [member.user_id, member.profiles.display_name])).entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const groupByApplication = new Map((groupMembersResult.data ?? []).map((member) => [
    member.application_id,
    Array.isArray(member.case_groups) ? member.case_groups[0]?.name : member.case_groups.name,
  ]));
  const assignmentCounts = new Map<string, { total: number; submitted: number }>();
  for (const assignment of assignments) {
    const application = Array.isArray(assignment.applications) ? assignment.applications[0] : assignment.applications;
    if (!application) continue;
    const counts = assignmentCounts.get(application.id) ?? { total: 0, submitted: 0 };
    counts.total += 1;
    if (["SUBMITTED", "LOCKED"].includes(assignment.status)) counts.submitted += 1;
    assignmentCounts.set(application.id, counts);
  }
  const coveredApplicants = activeApplications.filter((application) => (assignmentCounts.get(application.id)?.total ?? 0) >= 2).length;
  const submittedAssignments = assignments.filter((assignment) => ["SUBMITTED", "LOCKED"].includes(assignment.status)).length;

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
      <BoardNav current={nav} recruitmentOperations={canOperate} hashPanel={canHash} />
      {!round ? (
        <div className="rounded-xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-center">
          <p className="text-[13px] text-mecg-navy/40">This cycle does not have a {title} round yet.</p>
        </div>
      ) : (
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm text-mecg-navy/55">
              Round status: {round.status}. {canManage ? "Use Pipeline operations to publish, activate, and freeze it." : null}
            </p>
            {canOperate ? (
              <p className="font-mono text-xs text-mecg-navy/50">
                {assignments.length} assignment{assignments.length === 1 ? "" : "s"} in this round
              </p>
            ) : null}
          </div>
          {canOperate && (
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                [String(activeApplications.length), "applicants"],
                [`${coveredApplicants}/${activeApplications.length}`, "covered twice"],
                [String(assignments.length - submittedAssignments), "open forms"],
                [String(submittedAssignments), "submitted"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-mecg-navy px-4 py-3 text-white">
                  <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-white/50">{label}</p>
                </div>
              ))}
            </div>
          )}
          {canOperate && ["DRAFT", "PUBLISHED"].includes(round.status) && (
            <RoundAssignmentForm
              cycleId={cycleId}
              roundId={round.id}
              applicants={activeApplications.map((application) => ({ id: application.id, label: application.pnms.name }))}
              evaluators={evaluatorOptions}
            />
          )}
          {!canOperate ? null : assignments.length === 0 ? (
            <div className="mt-4 rounded-xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-center">
              <p className="text-[13px] text-mecg-navy/40">No assignments yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-mecg-navy/10">
                  <th className="py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Applicant</th>
                  {kind === "GROUP_CASE" && <th className="py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Case team</th>}
                  <th className="py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Evaluator</th>
                  <th className="py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Assignment</th>
                  <th className="py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Evaluation</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => {
                  const application = Array.isArray(assignment.applications) ? assignment.applications[0] : assignment.applications;
                  const person = application?.pnms && (Array.isArray(application.pnms) ? application.pnms[0] : application.pnms);
                  const applicantName = person?.name ?? "Applicant";
                  const submitted = ["SUBMITTED", "LOCKED"].includes(assignment.status);
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
                      {kind === "GROUP_CASE" && <td className="py-2.5 text-[13px] text-mecg-navy/55">{groupByApplication.get(application?.id ?? "") ?? "Unassigned"}</td>}
                      <td className="py-2.5 text-[13px] text-mecg-navy/55">{Array.isArray(assignment.evaluator) ? assignment.evaluator[0]?.display_name : assignment.evaluator?.display_name}</td>
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
            </div>
          )}
        </section>
      )}
    </main>
  );
}
