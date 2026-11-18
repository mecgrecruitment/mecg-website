// design-owner: client:mecg because the internal workspace follows docs/DESIGN.md tokens and admin patterns
import Link from "next/link";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { formatCalendarDate, PIPELINE_TRACKS, rollupGrid, type Rollup } from "@/lib/opportunities/model";

function OverdueList({ rollup, cycleId }: { rollup: Rollup; cycleId: string }) {
  const records = rollup.overdueRecords ?? [];
  return (
    <section aria-labelledby="overdue-title" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="overdue-title" className="text-lg font-semibold text-mecg-navy">Past-due next actions</h2>
        <Link className="text-sm font-semibold text-mecg-navy underline underline-offset-4" href={withWorkspaceCycle("/member/tools/pipeline", cycleId)}>Open the pipeline</Link>
      </div>
      <p className="text-sm leading-6 text-muted">You see these names because you are a pipeline reviewer for this cycle. Other board members see the counts only.</p>
      {records.length === 0 ? (
        <p className="text-sm text-muted">No next actions are past due.</p>
      ) : (
        <ul className="workspace-panel rounded-xl bg-white">
          {records.map((record) => (
            <li key={record.id} className="grid gap-1 border-t border-line py-3 first:border-t-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-baseline sm:gap-4">
              <p className="min-w-0 break-words text-sm font-semibold text-mecg-navy">{record.title || "Untitled"}</p>
              <p className="text-sm text-muted"><span className="sr-only">Stage and type: </span>{record.stage} · {record.track}</p>
              <p className="tabular-nums text-sm font-semibold text-mecg-orange-ink"><span className="sr-only">Next action was due </span>{formatCalendarDate(record.nextDate)}</p>
              <p className="min-w-0 truncate text-sm text-muted"><span className="sr-only">Owner: </span>{record.ownerName || "Unknown member"}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function PipelineRollup({ rollup, cycleId }: { rollup: Rollup | null; cycleId: string }) {
  if (!rollup) {
    return (
      <p role="alert" className="rounded-xl bg-white p-4 text-sm text-muted inset-ring inset-ring-line">
        Opportunity counts could not be loaded. Nothing is shown rather than a partial count. Try again later.
      </p>
    );
  }
  const { rows, trackTotals } = rollupGrid(rollup);
  const metrics: { label: string; value: number; alert?: boolean }[] = [
    { label: "Opportunities", value: rollup.total },
    ...PIPELINE_TRACKS.map((track) => ({ label: track, value: trackTotals[track] ?? 0 })),
    { label: "Past due", value: rollup.overdue, alert: rollup.overdue > 0 },
  ];
  return (
    <div className="space-y-8">
      <section aria-labelledby="rollup-title" className="space-y-6">
        <h2 id="rollup-title" className="sr-only">Opportunity counts</h2>
        <dl className="grid grid-cols-2 gap-4 border-b border-line pb-6 sm:grid-cols-4">
          {metrics.map(({ label, value, alert }) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className={`tabular-nums mt-1 text-xl font-semibold ${alert ? "text-mecg-orange-ink" : "text-mecg-navy"}`}>{value}</dd>
            </div>
          ))}
        </dl>
        {rollup.total === 0 ? (
          <p className="text-sm text-muted">No member has added a client or sponsor opportunity in this cycle yet.</p>
        ) : (
          <div className="workspace-panel overflow-x-auto rounded-xl bg-white">
            <table className="w-full min-w-[20rem] text-sm">
              <caption className="sr-only">Opportunities by stage and type</caption>
              <thead>
                <tr className="text-left text-xs font-semibold text-muted">
                  <th scope="col" className="pb-2 font-semibold">Stage</th>
                  {PIPELINE_TRACKS.map((track) => <th key={track} scope="col" className="pb-2 text-right font-semibold">{track}</th>)}
                  <th scope="col" className="pb-2 text-right font-semibold">Total</th>
                  <th scope="col" className="pb-2 text-right font-semibold">Past due</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((row) => (
                  <tr key={row.stage} className="border-t border-line">
                    <th scope="row" className="py-2 text-left font-semibold text-mecg-navy">{row.stage}</th>
                    {PIPELINE_TRACKS.map((track) => <td key={track} className={`py-2 text-right ${row.byTrack[track] ? "" : "text-muted"}`}>{row.byTrack[track]}</td>)}
                    <td className={`py-2 text-right font-semibold ${row.total ? "text-mecg-navy" : "text-muted"}`}>{row.total}</td>
                    <td className={`py-2 text-right ${row.overdue ? "font-semibold text-mecg-orange-ink" : "text-muted"}`}>{row.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="space-y-1 text-sm leading-6 text-muted">
          <p>Past due means the next-action date is before today ({formatCalendarDate(rollup.asOf)}, Detroit time). Closed opportunities are never past due; one with no next-action date is never past due.</p>
          {rollup.unclassified > 0 && <p>{rollup.unclassified} {rollup.unclassified === 1 ? "opportunity has" : "opportunities have"} a stage or type that is no longer offered. {rollup.unclassified === 1 ? "It is" : "They are"} counted in the total only.</p>}
          {!rollup.canReview && <p>Opportunity names, contacts and notes stay with the members who own them and the cycle&apos;s pipeline reviewers. Board rank shows counts only.</p>}
        </div>
      </section>
      {rollup.canReview && <OverdueList rollup={rollup} cycleId={cycleId} />}
    </div>
  );
}
