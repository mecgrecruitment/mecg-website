import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { initials } from "@/lib/initials";
import SectionLabel from "@/components/section-label";
import StatTile from "@/components/stat-tile";
import StatusPill from "@/components/status-pill";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import RoundAssignmentForm from "./round-assignment-form";

export default async function RoundBoardPage({ kind, title, nav }: { kind: string; title: string; nav: string }) {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS") ?? selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS");
  if (!cycleId) redirect("/member");
  const canOperate = hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS");
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
  const uncoveredApplicants = activeApplications.filter((application) => (assignmentCounts.get(application.id)?.total ?? 0) === 0);
  const evaluatorLoad = new Map<string, { name: string; open: number; total: number }>();
  for (const assignment of assignments) {
    const evaluatorName = Array.isArray(assignment.evaluator) ? assignment.evaluator[0]?.display_name : assignment.evaluator?.display_name;
    const entry = evaluatorLoad.get(assignment.evaluator_id) ?? { name: evaluatorName ?? "Unassigned", open: 0, total: 0 };
    entry.total += 1;
    if (!["SUBMITTED", "LOCKED"].includes(assignment.status)) entry.open += 1;
    evaluatorLoad.set(assignment.evaluator_id, entry);
  }
  const evaluatorLoadList = Array.from(evaluatorLoad.entries()).sort(([, a], [, b]) => b.open - a.open);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <WorkspaceHeader eyebrow={`${cycle.name} · ${cycle.status}`} title={title} />
      <WorkspaceNav user={user} cycleId={cycleId} current={nav} />
      {!round ? (
        <div className="rounded-xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-center">
          <p className="text-[13px] text-mecg-navy/60">This cycle does not have a {title} round yet.</p>
        </div>
      ) : (
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <p className="text-pretty text-sm leading-6 text-mecg-navy/55">
              Round status: {round.status}. {canManage ? "Use Pipeline operations to publish, activate, and freeze it." : null}
            </p>
            {canOperate ? (
              <p className="font-mono text-xs text-mecg-navy/60">
                {assignments.length} assignment{assignments.length === 1 ? "" : "s"} in this round
              </p>
            ) : null}
          </div>
          {canOperate && (
            <>
              <SectionLabel>Round workload</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                {[
                  [String(activeApplications.length), "applicants"],
                  [`${coveredApplicants}/${activeApplications.length}`, "covered twice"],
                  [String(assignments.length - submittedAssignments), "open forms"],
                  [String(submittedAssignments), "submitted"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl bg-mecg-navy px-4 py-3.5 sm:py-3">
                    <StatTile value={value} label={label} tone="dark" />
                  </div>
                ))}
              </div>
              {(uncoveredApplicants.length > 0 || evaluatorLoadList.length > 0) && (
                <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                  {uncoveredApplicants.length > 0 && (
                    <div className="rounded-2xl bg-paper p-3.5 sm:p-4">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/60">Needs an evaluator · {uncoveredApplicants.length}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {uncoveredApplicants.map((application) => (
                          <Link
                            key={application.id}
                            href={`/admin/applications/${application.id}`}
                            className="inline-flex min-h-8 items-center rounded-[2px] bg-white px-2.5 py-1 text-xs font-medium text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] hover:bg-mecg-blue/[0.08]"
                          >
                            {application.pnms.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {evaluatorLoadList.length > 0 && (
                    <div className="rounded-2xl bg-paper p-3.5 sm:p-4">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/60">Evaluator load</p>
                      <div className="mt-2 flex flex-col gap-1.5">
                        {evaluatorLoadList.map(([evaluatorId, evaluator]) => (
                          <div key={evaluatorId} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                            <span className="font-medium text-mecg-navy">{evaluator.name}</span>
                            <span className="font-mono text-xs text-mecg-navy/60">{evaluator.open} open · {evaluator.total} total</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
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
              <p className="text-[13px] text-mecg-navy/60">No assignments yet</p>
            </div>
          ) : (
            <>
              <SectionLabel>Assignments</SectionLabel>
              <div className="flex flex-col gap-3 md:hidden">
                {assignments.map((assignment) => {
                  const application = Array.isArray(assignment.applications) ? assignment.applications[0] : assignment.applications;
                  const person = application?.pnms && (Array.isArray(application.pnms) ? application.pnms[0] : application.pnms);
                  const applicantName = person?.name ?? "Applicant";
                  const submitted = ["SUBMITTED", "LOCKED"].includes(assignment.status);
                  const evaluator = Array.isArray(assignment.evaluator) ? assignment.evaluator[0]?.display_name : assignment.evaluator?.display_name;
                  return (
                    <article key={assignment.id} className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mecg-navy font-mono text-[10px] font-semibold text-white">{initials(applicantName)}</span>
                          <p className="font-semibold text-mecg-navy">{applicantName}</p>
                        </div>
                        <StatusPill tone={submitted ? "navy" : "neutral"}>{submitted ? "Submitted" : "Open"}</StatusPill>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <dt className="font-mono uppercase tracking-[0.08em] text-mecg-navy/60">Evaluator</dt>
                          <dd className="mt-1 text-mecg-navy/70">{evaluator ?? "Unassigned"}</dd>
                        </div>
                        <div>
                          <dt className="font-mono uppercase tracking-[0.08em] text-mecg-navy/60">Assignment</dt>
                          <dd className="mt-1 text-mecg-navy/70">{assignment.status}</dd>
                        </div>
                        {kind === "GROUP_CASE" && (
                          <div className="col-span-2">
                            <dt className="font-mono uppercase tracking-[0.08em] text-mecg-navy/60">Case team</dt>
                            <dd className="mt-1 text-mecg-navy/70">{groupByApplication.get(application?.id ?? "") ?? "Unassigned"}</dd>
                          </div>
                        )}
                      </dl>
                    </article>
                  );
                })}
              </div>
            <div className="scroll-cue -mx-4 hidden overflow-x-auto px-4 pb-1 md:block sm:mx-0 sm:px-0" tabIndex={0} role="region" aria-label={`${title} assignments`}>
              <div className="min-w-[42rem] overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-mecg-navy/10">
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Applicant</th>
                  {kind === "GROUP_CASE" && <th className="px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Case team</th>}
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Evaluator</th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Assignment</th>
                  <th className="px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Evaluation</th>
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-mecg-navy font-mono text-[10px] font-semibold text-white">
                            {initials(applicantName)}
                          </span>
                          <span className="text-[13px] font-semibold text-mecg-navy">{applicantName}</span>
                        </div>
                      </td>
                      {kind === "GROUP_CASE" && <td className="px-4 py-3 text-[13px] text-mecg-navy/55">{groupByApplication.get(application?.id ?? "") ?? "Unassigned"}</td>}
                      <td className="px-4 py-3 text-[13px] text-mecg-navy/55">{Array.isArray(assignment.evaluator) ? assignment.evaluator[0]?.display_name : assignment.evaluator?.display_name}</td>
                      <td className="px-4 py-3 text-[13px] text-mecg-navy/55">{assignment.status}</td>
                      <td className="px-4 py-3">
                        <StatusPill tone={submitted ? "navy" : "neutral"}>{submitted ? "Submitted" : "Open"}</StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
              </div>
            </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
