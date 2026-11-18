// design-owner: client:mecg because the internal workspace follows docs/DESIGN.md tokens and admin patterns
import Link from "next/link";
import StatusPill from "@/components/status-pill";
import { memberRoleLabel } from "@/lib/labels";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { assessMember, REASON_LABELS, sortForReview, summarize, type Standing, type StandingMember, type StandingThresholds } from "@/lib/standing/model";

function thresholdSentence(thresholds: StandingThresholds) {
  const parts = [
    thresholds.minAttendancePct > 0 ? `attends at least ${thresholds.minAttendancePct}% of held events` : null,
    thresholds.minProjects > 0 ? `is staffed on at least ${thresholds.minProjects} project${thresholds.minProjects === 1 ? "" : "s"}` : null,
    thresholds.requireOnboarding ? "has finished onboarding" : null,
  ].filter(Boolean);
  return parts.length ? `A member is active when they ${parts.join(", ")}.` : "Every threshold is off, so no one is flagged.";
}

function Row({ member, thresholds }: { member: StandingMember; thresholds: StandingThresholds }) {
  const assessment = assessMember(member, thresholds);
  const roles = member.roles.filter((role) => role !== "MEMBER");
  return (
    <li className="grid gap-3 border-t border-line py-4 first:border-t-0 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_minmax(0,1.8fr)] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-mecg-navy">{member.name}</p>
        {roles.length > 0 && <p className="text-xs text-muted">{roles.map(memberRoleLabel).join(", ")}</p>}
      </div>
      <div className="flex items-baseline justify-between gap-2 sm:block">
        <span className="text-xs text-muted sm:sr-only">Events: </span>
        <span className={`tabular-nums text-sm ${assessment.reasons.includes("ATTENDANCE") ? "font-semibold text-mecg-orange-ink" : ""}`}>
          {member.eventsHeld ? `${member.eventsAttended} of ${member.eventsHeld} · ${assessment.attendancePct}%` : "No events yet"}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2 sm:block">
        <span className="text-xs text-muted sm:sr-only">Projects: </span>
        <span className={`tabular-nums text-sm ${assessment.reasons.includes("PROJECTS") ? "font-semibold text-mecg-orange-ink" : ""}`}>
          {member.projects === 1 ? "1 project" : `${member.projects} projects`}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2 sm:block">
        <span className="text-xs text-muted sm:sr-only">Onboarding: </span>
        <span className={`tabular-nums text-sm ${assessment.reasons.includes("ONBOARDING") ? "font-semibold text-mecg-orange-ink" : ""}`}>
          {member.onboardingTotal === null ? <span className="text-muted">Not tracked</span> : `${member.onboardingDone} of ${member.onboardingTotal} done`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <span className="sr-only">Standing: </span>
        {assessment.status === "ACTIVE"
          ? <StatusPill tone="neutral">Active</StatusPill>
          : <StatusPill tone="orange">At risk · {assessment.reasons.map((reason) => REASON_LABELS[reason]).join(", ")}</StatusPill>}
      </div>
    </li>
  );
}

export default function MemberStanding({ standing, cycleId }: { standing: Standing | null; cycleId: string }) {
  if (!standing) {
    return (
      <p role="alert" className="rounded-xl bg-white p-4 text-sm text-muted inset-ring inset-ring-line">
        Member standing could not be loaded. Nothing is shown rather than a partial rollup. Try again later.
      </p>
    );
  }
  const { thresholds, members } = standing;
  const summary = summarize(members, thresholds);
  const metrics: [string, number][] = [
    ["Active members", summary.total],
    ["At risk", summary.atRisk],
    [REASON_LABELS.ATTENDANCE, summary.reasons.ATTENDANCE],
    [REASON_LABELS.PROJECTS, summary.reasons.PROJECTS],
    [REASON_LABELS.ONBOARDING, summary.reasons.ONBOARDING],
  ];
  return (
    <section aria-labelledby="standing-title" className="space-y-6">
      <h2 id="standing-title" className="sr-only">Member standing</h2>
      <dl className="grid grid-cols-2 gap-4 border-b border-line pb-6 sm:grid-cols-5">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <span className="tabular-nums mt-1 text-xl font-semibold text-mecg-navy">{value}</span>
          </div>
        ))}
      </dl>
      <div className="space-y-1 text-sm leading-6 text-muted">
        <p>
          {thresholdSentence(thresholds)}{" "}
          {thresholds.configured ? "" : "These are the default thresholds. "}
          <Link className="font-semibold text-mecg-navy underline underline-offset-4" href={withWorkspaceCycle("/admin/settings#member-standing", cycleId)}>Change thresholds</Link>
        </p>
        <p>Held events are this cycle&apos;s published or closed events whose check-in has closed, counted from when the member joined the cycle. Projects count every project the member is staffed on. Onboarding is the checklist from an offer they accepted in this cycle; members without one are not flagged for it.</p>
      </div>
      {members.length === 0 ? (
        <p className="text-sm text-muted">No active members in this cycle.</p>
      ) : (
        <div className="workspace-panel rounded-xl bg-white">
          <div aria-hidden="true" className="hidden gap-4 pb-2 text-xs font-semibold text-muted sm:grid sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_minmax(0,1.8fr)]">
            <span>Member</span><span>Events attended</span><span>Projects</span><span>Onboarding</span><span className="text-right">Standing</span>
          </div>
          <ul>
            {sortForReview(members, thresholds).map((member) => <Row key={member.userId} member={member} thresholds={thresholds} />)}
          </ul>
        </div>
      )}
    </section>
  );
}
