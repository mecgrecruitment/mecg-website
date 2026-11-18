// design-owner: client:mecg because the internal workspace follows docs/DESIGN.md tokens and admin patterns
import Link from "next/link";
import StatusPill from "@/components/status-pill";
import { memberRoleLabel } from "@/lib/labels";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { LOAD_LABELS, loadSignal, matchesSkill, sortForPlanning, summarizePlan, type PlanMember, type StaffingPlan } from "@/lib/staffing/model";

const GRID = "sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.6fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.1fr)]";

function titles(ids: string[], names: Map<string, string>) {
  // A project deleted after a member chose it simply drops out.
  return ids.map((id) => names.get(id)).filter((title): title is string => Boolean(title));
}

function Row({ member, names }: { member: PlanMember; names: Map<string, string> }) {
  const signal = loadSignal(member);
  const roles = member.roles.filter((role) => role !== "MEMBER");
  const staffed = titles(member.staffedProjectIds, names);
  const wanted = titles(member.preferredProjectIds, names);
  return (
    <li className={`grid gap-3 border-t border-line py-4 first:border-t-0 sm:items-start sm:gap-4 ${GRID}`}>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-mecg-navy">{member.name}</p>
        {roles.length > 0 && <p className="text-xs text-muted">{roles.map(memberRoleLabel).join(", ")}</p>}
      </div>
      <div className="flex items-baseline justify-between gap-2 sm:block">
        <span className="text-xs text-muted sm:sr-only">Hours a week: </span>
        <span className="tabular-nums text-sm">{member.weeklyHours === null ? <span className="text-muted">—</span> : `${member.weeklyHours} h`}</span>
      </div>
      <div className="min-w-0 text-sm">
        <span className="text-xs text-muted sm:sr-only">Skills: </span>
        {member.skills.length ? member.skills.join(", ") : <span className="text-muted">—</span>}
        {member.notes && <p className="mt-1 text-xs leading-5 text-muted">{member.notes}</p>}
      </div>
      <div className="min-w-0 text-sm">
        <span className="text-xs text-muted sm:sr-only">Wants: </span>
        {wanted.length ? <ol className="list-inside list-decimal">{wanted.map((title, index) => <li key={index}>{title}</li>)}</ol> : <span className="text-muted">—</span>}
      </div>
      <div className="flex flex-col gap-2 sm:items-end">
        <span className="sr-only">Load: </span>
        <StatusPill tone={signal === "OPEN" ? "navy" : signal === "OVER" ? "orange" : "neutral"}>{LOAD_LABELS[signal]}</StatusPill>
        <span className="text-xs text-muted sm:text-right">
          {staffed.length ? `On ${staffed.join(", ")}` : "No current projects"}
        </span>
      </div>
    </li>
  );
}

export default function StaffingPlanView({ plan, cycleId, skill }: { plan: StaffingPlan | null; cycleId: string; skill: string }) {
  if (!plan) {
    return (
      <p role="alert" className="rounded-xl bg-white p-4 text-sm text-muted inset-ring inset-ring-line">
        The staffing plan could not be loaded. Nothing is shown rather than a partial plan. Try again later.
      </p>
    );
  }
  const names = new Map(plan.projects.map((project) => [project.id, project.title]));
  const summary = summarizePlan(plan.members);
  const shown = sortForPlanning(plan.members.filter((member) => matchesSkill(member, skill)));
  const interest = new Map<string, number>();
  for (const member of plan.members) for (const id of member.preferredProjectIds) interest.set(id, (interest.get(id) ?? 0) + 1);
  const wanted = plan.projects.filter((project) => interest.has(project.id));
  const metrics: [string, number][] = [
    ["Members", summary.members],
    ["Submitted", summary.submitted],
    ["Hours a week", summary.hours],
    [LOAD_LABELS.OPEN, summary.open],
  ];
  return (
    <section aria-labelledby="staffing-title" className="space-y-6">
      <h2 id="staffing-title" className="sr-only">Staffing plan</h2>
      <dl className="grid grid-cols-2 gap-4 border-b border-line pb-6 sm:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="tabular-nums mt-1 text-xl font-semibold text-mecg-navy">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm leading-6 text-muted">
        Members enter their own hours, skills and project choices for this cycle. Current projects count every project they are staffed on.{" "}
        <Link className="font-semibold text-mecg-navy underline underline-offset-4" href={withWorkspaceCycle("/admin/projects", cycleId)}>Assign people in Projects</Link>
      </p>
      {wanted.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-mecg-navy">Most wanted projects</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {[...wanted].sort((a, b) => (interest.get(b.id) ?? 0) - (interest.get(a.id) ?? 0) || a.title.localeCompare(b.title)).map((project) => (
              <li key={project.id} className="rounded-full bg-white px-3 py-1 text-xs inset-ring inset-ring-line">
                <span className="font-semibold text-mecg-navy">{project.title}</span>
                <span className="tabular-nums text-muted"> · {interest.get(project.id)} want · {project.staffCount} staffed</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="cycleId" value={cycleId} />
        <label className="min-w-0 text-sm font-medium">
          Filter by skill
          <input name="skill" defaultValue={skill} maxLength={40} className="mt-2 block min-h-11 w-64 max-w-full rounded-xl bg-white px-3 text-sm inset-ring inset-ring-line-strong outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]" />
        </label>
        <button type="submit" className="button-secondary min-h-11">Filter</button>
        {skill && <Link className="text-sm font-semibold text-mecg-navy underline underline-offset-4" href={withWorkspaceCycle("/admin/staffing", cycleId)}>Clear</Link>}
      </form>
      {plan.members.length === 0 ? (
        <p className="text-sm text-muted">No active members in this cycle.</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted">No one lists a skill matching &ldquo;{skill}&rdquo;.</p>
      ) : (
        <div className="workspace-panel rounded-xl bg-white">
          <div aria-hidden="true" className={`hidden gap-4 pb-2 text-xs font-semibold text-muted sm:grid ${GRID}`}>
            <span>Member</span><span>Hours</span><span>Skills and notes</span><span>Wants</span><span className="text-right">Load</span>
          </div>
          <ul>{shown.map((member) => <Row key={member.userId} member={member} names={names} />)}</ul>
        </div>
      )}
    </section>
  );
}
