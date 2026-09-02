import type { RecruitmentAnalytics } from "./recruitment-analytics";

function Suppressed({ count, minimum }: { count: number; minimum: number }) {
  return <p className="text-sm text-mecg-navy/55">Suppressed: {count} eligible reviewers. At least {minimum} are required for a privacy-safe aggregate.</p>;
}

export default function RecruitmentAnalyticsPanel({ analytics }: { analytics: RecruitmentAnalytics | null }) {
  return (
    <details className="group border-y border-mecg-navy/[0.12] py-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 marker:content-none">
        <span>
          <span className="block text-lg font-semibold text-mecg-navy">Post-cycle analytics</span>
          <span className="mt-1 block text-sm font-normal text-mecg-navy/55">Aggregate advisory signals for improving the next recruitment cycle.</span>
        </span>
        <span className="text-sm text-mecg-navy/50 transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
      </summary>
      <div className="mt-4 border-l-2 border-mecg-navy/[0.1] pl-4">
        {!analytics ? (
          <p className="text-sm text-mecg-orange-ink">Analytics could not be loaded safely.</p>
        ) : !analytics.available ? (
          <p className="text-sm text-mecg-navy/55">Analytics unlock after the cycle closes. No live-cycle rankings are produced.</p>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-xs leading-5 text-mecg-navy/55">These signals describe process quality only. They never adjust applicant scores or identify an applicant or evaluator.</p>
            <div>
              <h3 className="text-sm font-semibold text-mecg-navy">Cycle funnel</h3>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
                {analytics.funnel.map((stage) => (
                  <div key={stage.key}>
                    <dt className="text-xs text-mecg-navy/55">{stage.label}</dt>
                    <dd className="tabular text-xl font-semibold text-mecg-navy">{stage.count}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-mecg-navy">Round completion</summary>
              <div className="mt-2 divide-y divide-mecg-navy/[0.08]">
                {analytics.rounds.map((round, index) => (
                  <div key={`${index}-${round.roundName}`} className="grid gap-1 py-2 text-sm sm:grid-cols-[1fr_auto_auto] sm:gap-5">
                    <span className="font-medium text-mecg-navy">{round.roundName}</span>
                    <span className="text-mecg-navy/55">{round.completed}/{round.assigned} complete</span>
                    <span className="tabular text-mecg-navy/55">{round.completionRate == null ? "No assignments" : `${round.completionRate.toFixed(1)}%`}</span>
                  </div>
                ))}
                {!analytics.rounds.length && <p className="py-2 text-sm text-mecg-navy/55">No rounds recorded.</p>}
              </div>
            </details>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-mecg-navy">Reviewer workload</summary>
              <div className="mt-2">
                {analytics.workload.suppressed ? (
                  <Suppressed count={analytics.workload.evaluatorCount} minimum={analytics.workload.minimumCohort ?? analytics.minimumCohort} />
                ) : (
                  <>
                    <p className="text-sm text-mecg-navy/55">Median {analytics.workload.medianAssignments?.toFixed(1)} assignments across {analytics.workload.evaluatorCount} reviewers.</p>
                    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-mecg-navy/60">
                      {analytics.workload.buckets?.map((bucket) => <li key={bucket.label}>{bucket.label} assignments: {bucket.evaluatorCount} reviewers</li>)}
                    </ul>
                  </>
                )}
              </div>
            </details>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-mecg-navy">Rubric criteria</summary>
              <div className="mt-2 divide-y divide-mecg-navy/[0.08]">
                {analytics.criteria.map((criterion, index) => (
                  <div key={`${index}-${criterion.roundName}-${criterion.criterionName}`} className="grid gap-1 py-2 text-sm sm:grid-cols-[1fr_auto] sm:gap-5">
                    <span className="text-mecg-navy"><span className="font-medium">{criterion.criterionName}</span> <span className="text-mecg-navy/45">· {criterion.roundName}</span></span>
                    <span className="text-mecg-navy/55">{criterion.suppressed ? `Suppressed below ${analytics.minimumCohort} ratings` : `${criterion.average?.toFixed(2)} average · ${criterion.spread?.toFixed(2) ?? "—"} spread · ${criterion.ratingCount} ratings`}</span>
                  </div>
                ))}
                {!analytics.criteria.length && <p className="py-2 text-sm text-mecg-navy/55">No locked rubric ratings recorded.</p>}
              </div>
            </details>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-mecg-navy">Reviewer consistency and drift</summary>
              <div className="mt-2">
                {analytics.evaluatorSignals.suppressed ? (
                  <Suppressed count={analytics.evaluatorSignals.evaluatorCount} minimum={analytics.evaluatorSignals.minimumCohort ?? analytics.minimumCohort} />
                ) : (
                  <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-xs text-mecg-navy/50">Median score spread</dt><dd className="tabular font-semibold text-mecg-navy">{analytics.evaluatorSignals.medianConsistency?.toFixed(2)}</dd></div>
                    <div><dt className="text-xs text-mecg-navy/50">Median first/second-half drift</dt><dd className="tabular font-semibold text-mecg-navy">{analytics.evaluatorSignals.medianAbsoluteDrift?.toFixed(2)}</dd></div>
                    <div><dt className="text-xs text-mecg-navy/50">High-variance reviewers</dt><dd className="tabular font-semibold text-mecg-navy">{analytics.evaluatorSignals.highVarianceCount}</dd></div>
                    <div><dt className="text-xs text-mecg-navy/50">High-drift reviewers</dt><dd className="tabular font-semibold text-mecg-navy">{analytics.evaluatorSignals.highDriftCount}</dd></div>
                  </dl>
                )}
                <p className="mt-2 text-xs leading-5 text-mecg-navy/50">Use these cohort-level signals to plan calibration. Do not infer individual performance or alter scores automatically.</p>
              </div>
            </details>
          </div>
        )}
      </div>
    </details>
  );
}
