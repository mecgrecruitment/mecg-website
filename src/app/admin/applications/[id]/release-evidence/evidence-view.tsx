import Link from "@/components/workspace-link";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { roundStatusLabel } from "@/lib/labels";
import type { ReleaseEvidenceReport } from "@/lib/release-evidence";

export default function ReleaseEvidenceView({ report, cycleId }: { report: ReleaseEvidenceReport; cycleId: string }) {
  return <div className="min-w-0 space-y-6">
    <section aria-labelledby="evidence-summary" className="border-y border-line py-5">
      <h2 id="evidence-summary" className="text-xl font-semibold">{report.ready ? "Evidence requirements are met" : "Evidence requirements are not met"}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">This is a current read of required rounds. It does not release an outcome. Recusals, approvals, permissions and the complete reviewed cohort are checked again by the release action.</p>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Counts use independent evaluators’ latest nonvoid, locked evaluations on the current rubric, excluding declared conflicts. Submitted forms alone do not count.</p>
      {report.blockers.includes("APPLICATION_INELIGIBLE") && <p className="mt-3 font-medium">This application is a draft or has been withdrawn. Do not release it; review its status with the recruitment owner.</p>}
      {report.blockers.includes("NO_REQUIRED_ROUNDS") && <p className="mt-3 font-medium">No weighted rounds are configured. The recruitment owner must review the cycle setup before release.</p>}
    </section>
    <div className="space-y-5">{report.rounds.map((round) => <section key={round.roundId} aria-labelledby={`round-${round.roundId}`} className="min-w-0 border-b border-line pb-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id={`round-${round.roundId}`} className="break-words text-lg font-semibold [overflow-wrap:anywhere]">{round.roundName}</h2><p className="text-sm text-muted">{roundStatusLabel(round.status)}</p></div>
      <p className="mt-3 text-sm leading-6"><strong className="tabular">{round.validLockedEvaluations}</strong> valid, locked independent evaluation{round.validLockedEvaluations === 1 ? "" : "s"} <span className="text-muted">· {round.requiredEvaluations} required</span></p>
      {round.blockers.includes("ROUND_NOT_CLOSED") && <p className="mt-3 text-sm leading-6">This round must be frozen or finalized under the existing grading process. Open its workspace to check valid evidence and outstanding work before closing.</p>}
      {round.blockers.includes("VALID_LOCKED_EVALUATIONS_MISSING") && <p className="mt-3 text-sm leading-6">{round.status === "FROZEN" || round.status === "FINALIZED" || round.status === "ARCHIVED"
        ? "Grading is closed but sufficient valid evidence is missing. Ask the recruitment owner for a Board-approved remediation process. This page cannot reopen or override the round."
        : "Sufficient valid, locked evidence is missing. While grading is open, collect genuine observations and resolve rubric requirements before closing; do not invent ratings to satisfy coverage."}</p>}
      {round.blockers.includes("VALID_LOCKED_EVALUATIONS_MISSING") && round.missingRequiredCriteria.length > 0 && <div className="mt-3 text-sm leading-6"><p className="font-semibold">Required criteria missing from locked observations</p><ul className="mt-1 list-disc space-y-1 pl-5">{round.missingRequiredCriteria.map((name, index) => <li key={`${name}-${index}`} className="break-words [overflow-wrap:anywhere]">{name}</li>)}</ul><p className="mt-2 max-w-3xl text-muted">These names come from current locked observations. Rubric minimums and weighted coverage may also be missing.</p></div>}
      {round.blockers.length === 0 && <p className="mt-3 text-sm font-semibold">This round meets the evidence requirement.</p>}
      <Link href={withWorkspaceCycle(`/admin/rounds/${encodeURIComponent(round.roundId)}`, cycleId)} className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Open {round.roundName} workspace</Link>
    </section>)}</div>
    <p className="max-w-3xl text-sm leading-6 text-muted">After resolving the underlying issue, return to recruitment and review release again. Counts can change; this read does not reserve readiness or bypass the release checks.</p>
  </div>;
}
