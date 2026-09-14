import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { RoundControls } from "./rush-controls";
import { memberAccountsFor } from "./member-accounts";
import RubricEditor, { type Criterion, type RoundRubric } from "./rounds/rubric-editor";
import GroupForms from "./groups/group-forms";
import { assignmentStatusLabel, cycleStatusLabel, roundStatusLabel } from "@/lib/labels";
import { countsTowardCoverage, groupCaseCoverageRank, groupCaseCoverageState } from "./group-case-coverage";
import { screeningRpc } from "@/lib/screening-rpc";
import SpeedDatingResultsTable, { type SpeedDatingResults } from "./speed-dating-results";
import GroupCaseResultsTable, { type GroupCaseResults } from "./group-case-results";

function parseRoundRubric(value: unknown, cycleId: string, round: { id: string; name: string; status: string }): RoundRubric | null {
  if (!Array.isArray(value)) return null;
  const entry = value.find((item) => item && typeof item === "object" && !Array.isArray(item) && (item as Record<string, unknown>).roundId === round.id);
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const row = entry as Record<string, unknown>;
  const criteria = Array.isArray(row.criteria)
    ? row.criteria.flatMap((item): Criterion[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const criterion = item as Record<string, unknown>;
      if (typeof criterion.key !== "string" || typeof criterion.name !== "string") return [];
      return [{
        key: criterion.key,
        name: criterion.name,
        description: typeof criterion.description === "string" ? criterion.description : "",
        weight: typeof criterion.weight === "number" ? criterion.weight : 1,
        required: criterion.required === true,
      }];
    })
    : [];
  return {
    cycleId,
    roundId: round.id,
    roundName: round.name,
    roundStatus: round.status,
    rubricVersion: typeof row.rubricVersion === "number" ? row.rubricVersion : null,
    criteria,
  };
}

export default async function RoundBoardPage({ roundId }: { roundId: string }) {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS")
    ?? selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS")
    ?? selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE");
  if (!cycleId) redirect("/member");
  const canOperate = hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS");
  const canManage = hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");
  const canExport = hasPermission(user.memberships, cycleId, "EXPORT");
  const supabase = await createClient();
  const [cycleResult, roundResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase
      .from("rounds")
      .select("id,name,status,kind,weight,evaluation_assignments(id,status,evaluator_id,applications(id,pnms(name)),evaluator:profiles(display_name),evaluations(id))")
      .eq("cycle_id", cycleId)
      .eq("id", roundId)
      .maybeSingle(),
  ]);
  const { data: cycle, error: cycleError } = cycleResult;
  if (cycleError) throw cycleError;
  if (roundResult.error) throw roundResult.error;
  if (!cycle) redirect("/member");
  const round = roundResult.data;
  if (!round) notFound();
  // Application screening has its own stepper page; the coverage board is for interview rounds.
  if (round.kind === "APPLICATION_SCREEN") redirect("/admin/screening");
  const canManageGroups = round.kind === "GROUP_CASE" && (canOperate || canManage);
  const [applicationsResult, membersResult, groupMembersResult, groupsResult, rubricsResult, speedDatingResultsResult, groupCaseResultsResult] = await Promise.all([
    supabase.from("applications").select("id,status,pnms!inner(name)").eq("cycle_id", cycleId),
    supabase.from("memberships").select("user_id,role,active,profiles!inner(display_name)").eq("cycle_id", cycleId).eq("active", true),
    round.kind === "GROUP_CASE"
      ? supabase.from("case_group_members").select("group_id,application_id,case_groups!inner(cycle_id,name)").eq("case_groups.cycle_id", cycleId)
      : Promise.resolve({ data: [], error: null }),
    canManageGroups
      ? supabase.from("case_groups").select("id,name,prompt").eq("cycle_id", cycleId)
      : Promise.resolve({ data: [], error: null }),
    canOperate
      ? supabase.rpc("cycle_rubrics", { target_cycle_id: cycleId })
      : Promise.resolve({ data: [], error: null }),
    round.kind === "SPEED_DATING" && canManage
      ? screeningRpc<SpeedDatingResults>(supabase, "speed_dating_results", { target_round_id: round.id })
      : Promise.resolve({ data: null, error: null }),
    round.kind === "GROUP_CASE" && canManage
      ? screeningRpc<GroupCaseResults>(supabase, "group_case_results", { target_round_id: round.id })
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const result of [applicationsResult, membersResult, groupMembersResult, groupsResult]) if (result.error) throw result.error;
  if (rubricsResult.error) console.error("cycle_rubrics failed", rubricsResult.error);
  if (speedDatingResultsResult.error) throw new Error(speedDatingResultsResult.error.message);
  if (groupCaseResultsResult.error) throw new Error(groupCaseResultsResult.error.message);
  const rubric = parseRoundRubric(rubricsResult.data, cycleId, round);
  const assignments = canOperate ? round?.evaluation_assignments ?? [] : [];
  const allApplications = (applicationsResult.data ?? [])
    .map((application) => ({ id: application.id, status: application.status, name: application.pnms.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Speed Dating and Group Case coverage describe their enrolled cohorts, not every open application in the cycle.
  const activeApplications = allApplications
    .filter((application) => round.kind === "SPEED_DATING"
      ? ["INVITED", "GROUP_CASE", "IN_PROCESS", "FINAL_REVIEW"].includes(application.status)
      : round.kind === "GROUP_CASE"
        ? ["GROUP_CASE", "IN_PROCESS", "FINAL_REVIEW"].includes(application.status)
        : !["DRAFT", "WITHDRAWN", "REJECTED", "WAITLISTED", "OFFERED"].includes(application.status))
    .map((application) => ({ id: application.id, label: application.name }));
  const accounts = memberAccountsFor(membersResult.data ?? []);
  const memberNameById = new Map(accounts.map((account) => [account.id, account.name]));
  const untouchedAssignments = assignments
    .filter((assignment) => assignment.evaluations.length === 0)
    .map((assignment) => {
      const application = Array.isArray(assignment.applications) ? assignment.applications[0] : assignment.applications;
      const person = application?.pnms && (Array.isArray(application.pnms) ? application.pnms[0] : application.pnms);
      return {
        id: assignment.id,
        label: round.name,
        evaluatorId: assignment.evaluator_id,
        evaluatorName: memberNameById.get(assignment.evaluator_id) ?? "Unknown evaluator",
        applicationName: person?.name ?? "Applicant",
      };
    });
  const groupByApplication = new Map((groupMembersResult.data ?? []).map((member) => [
    member.application_id,
    Array.isArray(member.case_groups) ? member.case_groups[0]?.name : member.case_groups.name,
  ]));
  const assignmentsByApplication = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    const application = Array.isArray(assignment.applications) ? assignment.applications[0] : assignment.applications;
    if (!application) continue;
    const applicationAssignments = assignmentsByApplication.get(application.id) ?? [];
    applicationAssignments.push(assignment);
    assignmentsByApplication.set(application.id, applicationAssignments);
  }
  const coverageByApplication = new Map(activeApplications.map((application) => [
    application.id,
    groupCaseCoverageState((assignmentsByApplication.get(application.id) ?? []).map((assignment) => assignment.status)),
  ]));
  const coveredApplicants = activeApplications.filter((application) => (coverageByApplication.get(application.id)?.assigned ?? 0) >= 2).length;
  const submittedAssignments = assignments.filter((assignment) => ["SUBMITTED", "LOCKED"].includes(assignment.status)).length;
  const openAssignments = assignments.filter((assignment) => ["ASSIGNED", "IN_PROGRESS"].includes(assignment.status)).length;
  const undercoveredApplicants = activeApplications.filter((application) => (coverageByApplication.get(application.id)?.assigned ?? 0) < 2);
  const evaluatorLoad = new Map<string, { name: string; open: number; total: number }>();
  for (const assignment of assignments) {
    if (!countsTowardCoverage(assignment.status)) continue;
    const evaluatorName = Array.isArray(assignment.evaluator) ? assignment.evaluator[0]?.display_name : assignment.evaluator?.display_name;
    const entry = evaluatorLoad.get(assignment.evaluator_id) ?? { name: evaluatorName ?? "Unassigned", open: 0, total: 0 };
    entry.total += 1;
    if (["ASSIGNED", "IN_PROGRESS"].includes(assignment.status)) entry.open += 1;
    evaluatorLoad.set(assignment.evaluator_id, entry);
  }
  const evaluatorLoadList = Array.from(evaluatorLoad.entries()).sort(([, a], [, b]) => b.open - a.open);
  const groupCaseCoverageRows = round.kind === "GROUP_CASE"
    ? activeApplications.map((application) => ({
      ...application,
      groupName: groupByApplication.get(application.id) ?? "Unassigned group",
      assignments: (assignmentsByApplication.get(application.id) ?? []).filter((assignment) => countsTowardCoverage(assignment.status)),
      coverage: coverageByApplication.get(application.id) ?? groupCaseCoverageState([]),
    })).sort((a, b) =>
      groupCaseCoverageRank(a.coverage.state) - groupCaseCoverageRank(b.coverage.state)
      || a.groupName.localeCompare(b.groupName)
      || a.label.localeCompare(b.label))
    : [];
  // Speed Dating has no pre-assignment: every member present grades every
  // applicant they meet, so workload counts graded applicants and graders.
  const speedDating = round.kind === "SPEED_DATING";
  const speedDatingResults = speedDating ? speedDatingResultsResult.data : null;
  const groupCaseResults = round.kind === "GROUP_CASE" ? groupCaseResultsResult.data : null;
  // Results carry group names; GroupForms keys teams by id.
  const groupIdByName = new Map((groupsResult.data ?? []).map((group) => [group.name, group.id]));
  const graderSetsByGroup = new Map<string, Set<string>>();
  for (const applicant of groupCaseResults?.applicants ?? []) {
    const groupId = applicant.groupName ? groupIdByName.get(applicant.groupName) : undefined;
    if (!groupId) continue;
    const set = graderSetsByGroup.get(groupId) ?? new Set<string>();
    for (const evaluation of applicant.evaluations) set.add(evaluation.evaluatorId);
    graderSetsByGroup.set(groupId, set);
  }
  const gradersByGroup = groupCaseResults
    ? Object.fromEntries([...graderSetsByGroup].map(([groupId, set]) => [groupId, set.size]))
    : undefined;
  const speedDatingGraded = speedDatingResults?.summary.graded ?? 0;
  const speedDatingGraders = speedDatingResults?.summary.graders ?? 0;

  return (
    <main className="workspace-stack mx-auto flex w-full max-w-7xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)}`}
        title={round.name}
        description="Manage this round's readiness, assignments, scoring guide, and results in one place."
        action={canOperate
          ? <Link href="/admin/rounds" className="button-secondary text-sm">All interviews</Link>
          : <Link href="/admin" className="button-secondary text-sm">Overview</Link>}
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/rounds" />
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <p className="text-pretty text-sm leading-6 text-mecg-navy/55">
            Round status: {roundStatusLabel(round.status)}.
          </p>
          {canOperate ? (
            <p className="tabular text-xs text-mecg-navy/60">
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
                  speedDating
                    ? [`${speedDatingGraded}/${activeApplications.length}`, "graded"]
                    : [`${coveredApplicants}/${activeApplications.length}`, "covered twice"],
                  speedDating ? [String(speedDatingGraders), "graders"] : [String(openAssignments), "open forms"],
                  [String(submittedAssignments), "submitted"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl bg-mecg-navy px-4 py-3.5 sm:py-3">
                    <StatTile value={value} label={label} tone="dark" />
                  </div>
                ))}
            </div>
            {(undercoveredApplicants.length > 0 || evaluatorLoadList.length > 0) && !speedDating && (
              <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                  {undercoveredApplicants.length > 0 && (
                    <div className="rounded-2xl bg-paper p-3.5 sm:p-4">
                      <p className="text-[13px] font-semibold text-mecg-navy/60">Needs coverage · {undercoveredApplicants.length}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {undercoveredApplicants.map((application) => (
                          <Link
                            key={application.id}
                            href={`/admin/applications/${application.id}`}
                            className="inline-flex min-h-8 items-center rounded-[2px] bg-white px-2.5 py-1 text-xs font-medium text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] hover:bg-mecg-blue/[0.08]"
                          >
                            {application.label} · {coverageByApplication.get(application.id)?.assigned ?? 0}/2
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {evaluatorLoadList.length > 0 && (
                    <div className="rounded-2xl bg-paper p-3.5 sm:p-4">
                      <p className="text-[13px] font-semibold text-mecg-navy/60">Evaluator load</p>
                      <div className="mt-2 flex flex-col gap-1.5">
                        {evaluatorLoadList.map(([evaluatorId, evaluator]) => (
                          <div key={evaluatorId} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                            <span className="font-medium text-mecg-navy">{evaluator.name}</span>
                            <span className="tabular text-xs text-mecg-navy/60">{evaluator.open} open · {evaluator.total} total</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </>
        )}
      </section>

      {canOperate && round.kind === "GROUP_CASE" && (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <SectionLabel>Group Case coverage</SectionLabel>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">Who still needs attention</h2>
              <p className="mt-1 text-sm text-mecg-navy/55">Any member at the table can grade. Applicants nobody has scored yet appear first.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-mecg-orange/[0.14] px-3 py-1 text-xs font-semibold text-mecg-orange-ink">
                {groupCaseCoverageRows.filter((row) => ["UNASSIGNED", "PARTIAL"].includes(row.coverage.state)).length} need coverage
              </span>
              {canExport && ["PUBLISHED", "ACTIVE"].includes(round.status) && (
                <>
                  <a
                    href={`/api/admin/export?kind=group-case&format=xlsx&cycleId=${encodeURIComponent(cycleId)}&roundId=${encodeURIComponent(round.id)}`}
                    className="button-primary text-sm"
                    download
                  >
                    Download Excel backup
                  </a>
                  <a
                    href={`/api/admin/export?kind=group-case&cycleId=${encodeURIComponent(cycleId)}&roundId=${encodeURIComponent(round.id)}`}
                    className="button-secondary text-sm"
                    download
                  >
                    Excel-ready CSV
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
            <div className="hidden grid-cols-[minmax(10rem,1fr)_minmax(8rem,0.8fr)_minmax(16rem,1.4fr)_8rem] gap-3 border-b border-mecg-navy/10 bg-paper px-4 py-3 text-[13px] font-semibold text-mecg-navy/55 md:grid">
              <span>Applicant</span>
              <span>Group</span>
              <span>Judges</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-mecg-navy/10">
              {groupCaseCoverageRows.map((row) => {
                const stateLabel = row.coverage.state === "UNASSIGNED"
                  ? "No judges"
                  : row.coverage.state === "PARTIAL"
                    ? "1 grader"
                    : row.coverage.state === "SUBMITTED"
                      ? "Complete"
                      : `${row.coverage.submitted} submitted`;
                return (
                  <article key={row.id} className="grid gap-3 bg-white px-4 py-4 md:grid-cols-[minmax(10rem,1fr)_minmax(8rem,0.8fr)_minmax(16rem,1.4fr)_8rem] md:items-center md:py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mecg-navy text-[10px] font-semibold text-white">{initials(row.label)}</span>
                      <Link href={`/admin/applications/${row.id}`} className="text-sm font-semibold text-mecg-navy hover:text-mecg-orange-ink">{row.label}</Link>
                    </div>
                    <p className="text-xs text-mecg-navy/60"><span className="mr-1 font-semibold md:hidden">Group:</span>{row.groupName}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {row.assignments.map((assignment) => {
                        const evaluator = Array.isArray(assignment.evaluator) ? assignment.evaluator[0]?.display_name : assignment.evaluator?.display_name;
                        return (
                          <span key={assignment.id} className="inline-flex items-center gap-1.5 rounded-full bg-mecg-navy/[0.055] px-2.5 py-1 text-xs text-mecg-navy/70">
                            <span className="font-semibold">{evaluator ?? "Unknown judge"}</span>
                            <span aria-hidden="true">·</span>
                            {assignmentStatusLabel(assignment.status)}
                          </span>
                        );
                      })}
                      {!row.assignments.length && <span className="text-xs font-semibold text-red-700">No grader yet</span>}
                    </div>
                    <StatusPill tone={row.coverage.state === "SUBMITTED" ? "navy" : row.coverage.state === "IN_PROGRESS" ? "neutral" : "orange"}>{stateLabel}</StatusPill>
                  </article>
                );
              })}
              {!groupCaseCoverageRows.length && (
                <p className="bg-white p-6 text-center text-sm text-mecg-navy/55">No active Group Case applicants yet.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {round.kind === "GROUP_CASE" && canManage && groupCaseResults && (
        <section>
          <SectionLabel>Results</SectionLabel>
          <p className="mt-1 text-sm text-mecg-navy/55">Weighted score out of 40: Collaboration and Composure count twice. Each grader&apos;s partial ratings count over the criteria they observed.</p>
          <div className="mt-4">
            <GroupCaseResultsTable
              results={groupCaseResults}
              canViewNotes={canOperate || canManage}
              canExport={canExport}
              exportHref={`/api/admin/export?kind=group-case&format=xlsx&cycleId=${encodeURIComponent(cycleId)}&roundId=${encodeURIComponent(round.id)}`}
            />
          </div>
        </section>
      )}

      {speedDating && canManage && speedDatingResults && (
        <section>
          <SectionLabel>Results</SectionLabel>
          <p className="mt-1 text-sm text-mecg-navy/55">Every member present grades every applicant they meet. Adjusted corrects for lenient and harsh graders; stars are the raw mean.</p>
          <div className="mt-4">
            <SpeedDatingResultsTable results={speedDatingResults} canViewNotes={canOperate || canManage} canExport={canExport} />
          </div>
        </section>
      )}

      {canOperate && (
        <RoundControls
          cycleId={cycleId}
          rounds={[{ id: round.id, label: round.name, status: round.status }]}
          memberAccounts={accounts}
          applications={activeApplications}
          assignments={untouchedAssignments}
          assignable={!speedDating}
        />
      )}

      {canManageGroups && (
        <section>
          <SectionLabel>Group setup</SectionLabel>
          <p className="mt-1 text-sm text-mecg-navy/55">Create the case teams, set their prompt, and place applicants before the interview begins.</p>
          <div className="mt-4">
            <GroupForms
              cycleId={cycleId}
              groups={groupsResult.data ?? []}
              applications={allApplications
                .filter((application) => ["GROUP_CASE", "IN_PROCESS", "FINAL_REVIEW"].includes(application.status))
                .map((application) => ({ id: application.id, name: application.name }))}
              members={(groupMembersResult.data ?? []).map((member) => ({ group_id: member.group_id, application_id: member.application_id }))}
              gradersByGroup={gradersByGroup}
            />
          </div>
        </section>
      )}

      {canOperate && rubric && <RubricEditor round={rubric} />}

      {canOperate && (
        <section>
          <SectionLabel>Results and assignments</SectionLabel>
          <p className="mt-1 text-sm text-mecg-navy/55">Track who is assigned and whether each evaluation is still open or submitted.</p>
          {assignments.length === 0 ? (
            <div className="mt-4 rounded-xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-center">
              <p className="text-[13px] text-mecg-navy/60">No assignments yet</p>
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-3 md:hidden">
                {assignments.map((assignment) => {
                  const application = Array.isArray(assignment.applications) ? assignment.applications[0] : assignment.applications;
                  const person = application?.pnms && (Array.isArray(application.pnms) ? application.pnms[0] : application.pnms);
                  const applicantName = person?.name ?? "Applicant";
                  const submitted = ["SUBMITTED", "LOCKED"].includes(assignment.status);
                  const evaluationState = submitted
                    ? "Submitted"
                    : ["RECUSED", "MISSED"].includes(assignment.status)
                      ? assignmentStatusLabel(assignment.status)
                      : "Open";
                  const evaluator = Array.isArray(assignment.evaluator) ? assignment.evaluator[0]?.display_name : assignment.evaluator?.display_name;
                  return (
                    <article key={assignment.id} className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mecg-navy text-[10px] font-semibold text-white">{initials(applicantName)}</span>
                          <p className="font-semibold text-mecg-navy">{applicantName}</p>
                        </div>
                        <StatusPill tone={submitted ? "navy" : "neutral"}>{evaluationState}</StatusPill>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <dt className="text-[13px] text-mecg-navy/60">Evaluator</dt>
                          <dd className="mt-1 text-mecg-navy/70">{evaluator ?? "Unassigned"}</dd>
                        </div>
                        <div>
                          <dt className="text-[13px] text-mecg-navy/60">Assignment</dt>
                          <dd className="mt-1 text-mecg-navy/70">{assignmentStatusLabel(assignment.status)}</dd>
                        </div>
                        {round.kind === "GROUP_CASE" && (
                          <div className="col-span-2">
                            <dt className="text-[13px] text-mecg-navy/60">Group interview</dt>
                            <dd className="mt-1 text-mecg-navy/70">{groupByApplication.get(application?.id ?? "") ?? "Unassigned"}</dd>
                          </div>
                        )}
                      </dl>
                    </article>
                  );
                })}
              </div>
            <div className="scroll-cue -mx-4 mt-4 hidden overflow-x-auto px-4 pb-1 md:block sm:mx-0 sm:px-0" tabIndex={0} role="region" aria-label={`${round.name} assignments`}>
              <div className="min-w-[42rem] overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-mecg-navy/10">
                  <th className="px-4 py-3 text-[13px] font-semibold text-mecg-navy/55">Applicant</th>
                  {round.kind === "GROUP_CASE" && <th className="px-4 py-3 text-[13px] font-semibold text-mecg-navy/55">Group interview</th>}
                  <th className="px-4 py-3 text-[13px] font-semibold text-mecg-navy/55">Evaluator</th>
                  <th className="px-4 py-3 text-[13px] font-semibold text-mecg-navy/55">Assignment</th>
                  <th className="px-4 py-3 text-[13px] font-semibold text-mecg-navy/55">Evaluation</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => {
                  const application = Array.isArray(assignment.applications) ? assignment.applications[0] : assignment.applications;
                  const person = application?.pnms && (Array.isArray(application.pnms) ? application.pnms[0] : application.pnms);
                  const applicantName = person?.name ?? "Applicant";
                  const submitted = ["SUBMITTED", "LOCKED"].includes(assignment.status);
                  const evaluationState = submitted
                    ? "Submitted"
                    : ["RECUSED", "MISSED"].includes(assignment.status)
                      ? assignmentStatusLabel(assignment.status)
                      : "Open";
                  return (
                    <tr key={assignment.id} className="border-b border-mecg-navy/10">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-mecg-navy text-[10px] font-semibold text-white">
                            {initials(applicantName)}
                          </span>
                          <span className="text-[13px] font-semibold text-mecg-navy">{applicantName}</span>
                        </div>
                      </td>
                      {round.kind === "GROUP_CASE" && <td className="px-4 py-3 text-[13px] text-mecg-navy/55">{groupByApplication.get(application?.id ?? "") ?? "Unassigned"}</td>}
                      <td className="px-4 py-3 text-[13px] text-mecg-navy/55">{Array.isArray(assignment.evaluator) ? assignment.evaluator[0]?.display_name : assignment.evaluator?.display_name}</td>
                      <td className="px-4 py-3 text-[13px] text-mecg-navy/55">{assignmentStatusLabel(assignment.status)}</td>
                      <td className="px-4 py-3">
                        <StatusPill tone={submitted ? "navy" : "neutral"}>{evaluationState}</StatusPill>
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
