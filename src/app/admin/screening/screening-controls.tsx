"use client";

import { useState, type ReactNode } from "react";
import { useAction } from "@/lib/use-action";
import OperationNotice from "@/components/operation-notice";

const READS_PER_APPLICATION = 3;
const MAX_READS_PER_READER = 100;

export type ScreeningBatchSummary = {
  id: string;
  status: "DRAFT" | "PUBLISHED" | "FROZEN";
  approved: number;
  pending: number;
  rejected: number;
  assigned: number;
  submitted: number;
  // Packets the overview returned. Zero with assignments present means the viewer is a reader and packets are hidden.
  packets: number;
  reviewers: Array<{ id: string; name: string; assigned: number; submitted: number }>;
};

type ApproveAllResult = { approved: number; failed: Array<{ packetId: string; code: string; reason: string }> };

function perReader(reads: number, readers: number) {
  return readers ? Math.ceil(reads / readers) : 0;
}

// One numbered row of the stepper. Done steps get a check and muted text; only
// the active step renders its body unless `open` says otherwise.
function Step({ number, title, state, summary, open = state === "active", children }: {
  number: number;
  title: string;
  state: "done" | "active" | "todo";
  summary?: ReactNode;
  open?: boolean;
  children?: ReactNode;
}) {
  const badge = {
    done: "bg-mecg-navy text-white",
    active: "bg-mecg-orange text-mecg-navy",
    todo: "text-mecg-navy/45 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)]",
  }[state];
  return (
    <li className={`grid gap-x-4 gap-y-2 py-5 sm:grid-cols-[2rem_minmax(0,1fr)] ${state === "todo" ? "opacity-60" : ""}`}>
      <span aria-hidden="true" className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${badge}`}>
        {state === "done"
          ? <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
          : number}
      </span>
      <div className="min-w-0">
        <h2 className={`text-lg font-semibold tracking-[-0.01em] ${state === "active" ? "text-mecg-navy" : "text-mecg-navy/60"}`}>
          <span className="sr-only">Step {number}{state === "done" ? ", done" : ""}: </span>{title}
        </h2>
        {summary && <p className="mt-1 text-sm text-mecg-navy/55">{summary}</p>}
        {open && children && <div className="mt-4">{children}</div>}
      </div>
    </li>
  );
}

export default function ScreeningControls({
  cycleId,
  members,
  submittedCount,
  batch,
  packetList,
  packetsHidden = false,
}: {
  cycleId: string;
  members: Array<{ id: string; name: string }>;
  submittedCount: number;
  batch?: ScreeningBatchSummary;
  packetList?: ReactNode;
  packetsHidden?: boolean;
}) {
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [approveResult, setApproveResult] = useState<ApproveAllResult | null>(null);
  const { pending, error, success, setSuccess, run } = useAction("/api/admin/screening");

  async function act(payload: Record<string, unknown>, successMessage: string) {
    await run({ cycleId, ...payload }, { successMessage });
  }

  async function approveAll() {
    if (!batch) return;
    setApproveResult(null);
    const result = await run({ cycleId, action: "APPROVE_ALL", batchId: batch.id });
    if (result.ok) setApproveResult((result.body as { data: ApproveAllResult }).data);
  }

  async function resetBatch() {
    if (!batch) return;
    if (!window.confirm("Delete this review batch and start again? Readers and approvals are discarded. Submitted reviews: 0.")) return;
    await act({ action: "RESET", batchId: batch.id }, "Batch deleted. Choose readers again.");
  }

  async function reassignReader(reviewer: ScreeningBatchSummary["reviewers"][number]) {
    if (!batch) return;
    const open = reviewer.assigned - reviewer.submitted;
    if (!window.confirm(`Move ${reviewer.name}'s ${open} unfinished applications to other readers?`)) return;
    const result = await run({ cycleId, action: "REASSIGN_READER", batchId: batch.id, reviewerId: reviewer.id });
    if (result.ok) setSuccess(`Moved ${(result.body as { data: { reassigned: number } }).data.reassigned} applications.`);
  }

  const unapproved = batch ? batch.pending + batch.rejected : 0;
  const readerCount = batch ? batch.reviewers.length : reviewerIds.length;
  const step2Done = Boolean(batch) && unapproved === 0;
  const step3Done = Boolean(batch) && batch?.status !== "DRAFT";
  const reviewsLeft = batch ? batch.assigned - batch.submitted : 0;
  const canReset = Boolean(batch) && (batch?.status === "DRAFT" || (batch?.status === "PUBLISHED" && batch.submitted === 0));
  const readsEach = perReader(READS_PER_APPLICATION * submittedCount, reviewerIds.length);
  const readersNeeded = Math.ceil((READS_PER_APPLICATION * submittedCount) / MAX_READS_PER_READER);
  const overCap = readsEach > MAX_READS_PER_READER;
  const missingFromBatch = batch?.status === "DRAFT" ? submittedCount - batch.packets : 0;
  const step1State = batch ? "done" : "active";
  const step2State = !batch ? "todo" : step2Done ? "done" : "active";
  const step3State = !batch ? "todo" : step3Done ? "done" : "active";
  const step4State = !batch || batch.status === "DRAFT" ? "todo" : batch.status === "FROZEN" ? "done" : "active";
  const notices = <div className="mt-4 space-y-2"><OperationNotice kind="error">{error}</OperationNotice><OperationNotice kind="success">{success}</OperationNotice></div>;

  return (
    <ol className="divide-y divide-mecg-navy/10 rounded-2xl px-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)] sm:px-6">
      <Step
        number={1}
        title="Choose readers"
        state={step1State}
        summary={batch ? (
          <>
            {batch.reviewers.length} readers: {batch.reviewers.map((reviewer) => reviewer.name).join(", ")}
            {canReset && <button type="button" disabled={pending} onClick={() => void resetBatch()} className="button-secondary ml-3 text-xs">Start over</button>}
          </>
        ) : undefined}
      >
        <p className="text-sm text-mecg-navy/55">Recruitment Committee, Board and Owner members can read. Panel members are excluded because they approve decisions. Pick everyone who will read; each application goes to three of them at random, conflicts excluded.</p>
        {members.length === 0 && (
          <p className="mt-4 rounded-xl bg-mecg-orange/10 px-4 py-3 text-sm text-mecg-orange-ink">
            No eligible readers are available. Add Recruitment Committee, Board or Owner members before creating the review batch.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setReviewerIds(members.map((member) => member.id))} className="button-secondary text-sm">Select all {members.length}</button>
          <button type="button" onClick={() => setReviewerIds([])} disabled={reviewerIds.length === 0} className="button-secondary text-sm">Clear</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {members.map((member) => {
            const checked = reviewerIds.includes(member.id);
            return (
              <label
                key={member.id}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  checked
                    ? "bg-mecg-orange/15 text-mecg-orange-ink shadow-[inset_0_0_0_1px_rgba(168,62,11,0.35)]"
                    : "text-mecg-navy/70 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.08]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setReviewerIds((current) => event.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id))}
                  className="sr-only"
                />
                {member.name}
              </label>
            );
          })}
        </div>
        <p className="mt-4 text-sm tabular-nums text-mecg-navy/70" aria-live="polite">
          {reviewerIds.length} readers · {READS_PER_APPLICATION} reads per application · about {readsEach} reads each
        </p>
        <button type="button" disabled={pending || reviewerIds.length < READS_PER_APPLICATION || overCap} onClick={() => void act({ action: "CREATE", reviewerIds }, "Review batch created. Approve the applications next.")} className="button-primary mt-4 disabled:opacity-50">
          Create review batch with {reviewerIds.length} readers
        </button>
        {reviewerIds.length < READS_PER_APPLICATION && <p className="mt-2 text-xs text-mecg-navy/55">Pick at least three readers.</p>}
        {overCap && <p className="mt-2 text-xs text-mecg-orange-ink">Each reader is capped at {MAX_READS_PER_READER} applications; pick at least {readersNeeded} readers.</p>}
        {step1State === "active" && notices}
      </Step>

      <Step
        number={2}
        title="Approve applications"
        state={step2State}
        open={batch?.status === "DRAFT"}
        summary={!batch ? undefined : packetsHidden ? "Hidden while you are a reader in this batch" : `${batch.approved} approved · ${batch.pending} pending · ${batch.rejected} rejected`}
      >
        {batch && (
          <>
            {missingFromBatch > 0 && (
              <div className="mb-4">
                <OperationNotice kind="info">{missingFromBatch} application{missingFromBatch === 1 ? " was" : "s were"} submitted after this batch was created and {missingFromBatch === 1 ? "is" : "are"} not in it. Start over to include {missingFromBatch === 1 ? "it" : "them"}.</OperationNotice>
              </div>
            )}
            <button type="button" disabled={pending || batch.pending === 0} onClick={() => void approveAll()} className="button-primary disabled:opacity-50">
              Approve all pending ({batch.pending})
            </button>
            {approveResult && (
              <div className="mt-4 rounded-xl bg-mecg-navy/[0.03] px-4 py-3 text-sm text-mecg-navy/70" role="status">
                <p>Approved {approveResult.approved}.{approveResult.failed.length > 0 && ` ${approveResult.failed.length} need a manual edit:`}</p>
                {approveResult.failed.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {approveResult.failed.map((failure) => <li key={failure.packetId}><span className="font-mono text-xs text-mecg-navy">{failure.code}</span> · {failure.reason}</li>)}
                  </ul>
                )}
              </div>
            )}
            {step2State === "active" && notices}
            {packetList}
          </>
        )}
      </Step>

      <Step
        number={3}
        title="Send out"
        state={step3State}
        summary={batch && step3Done ? `Sent ${batch.assigned} reads to ${readerCount} readers` : undefined}
      >
        {batch && (
          <>
            <p className="text-sm tabular-nums text-mecg-navy/70">
              {batch.approved} applications × {READS_PER_APPLICATION} = {batch.approved * READS_PER_APPLICATION} reads across {readerCount} readers, about {perReader(batch.approved * READS_PER_APPLICATION, readerCount)} each
            </p>
            <button type="button" disabled={pending || unapproved > 0} onClick={() => void act({ action: "DISTRIBUTE", batchId: batch.id }, "Readers assigned. Review is open.")} className="button-primary mt-4 disabled:opacity-50">
              Assign readers and open review
            </button>
            {unapproved > 0 && <p className="mt-2 text-xs text-mecg-navy/55">{unapproved} application{unapproved === 1 ? "" : "s"} still need approving in step 2.</p>}
            {step3State === "active" && notices}
          </>
        )}
      </Step>

      <Step
        number={4}
        title="Track and close"
        state={step4State}
        summary={batch?.status === "FROZEN" ? `Closed · ${batch.submitted} of ${batch.assigned} reviews submitted` : undefined}
      >
        {batch && (
          <>
            <p className="text-sm font-semibold tabular-nums text-mecg-navy">{batch.submitted} of {batch.assigned} reviews submitted</p>
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-mecg-navy/10 text-[13px] text-mecg-navy/55">
                  <th className="py-2 pr-4 font-semibold">Reader</th>
                  <th className="py-2 pr-4 font-semibold">Submitted</th>
                  <th className="w-1/2 py-2 pr-4 font-semibold"><span className="sr-only">Progress</span></th>
                  <th className="py-2 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {batch.reviewers.map((reviewer) => (
                  <tr key={reviewer.id} className="border-b border-mecg-navy/10">
                    <td className="py-2 pr-4 text-mecg-navy">{reviewer.name}</td>
                    <td className="py-2 pr-4 tabular-nums text-mecg-navy/70">{reviewer.submitted}/{reviewer.assigned}</td>
                    <td className="py-2 pr-4">
                      <div className="h-1.5 w-full rounded-full bg-mecg-navy/10" role="progressbar" aria-valuemin={0} aria-valuemax={reviewer.assigned} aria-valuenow={reviewer.submitted} aria-label={`${reviewer.name} progress`}>
                        <div className="h-1.5 rounded-full bg-mecg-navy" style={{ width: `${reviewer.assigned ? Math.round((reviewer.submitted / reviewer.assigned) * 100) : 0}%` }} />
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" disabled={pending || batch.status !== "PUBLISHED" || reviewer.assigned <= reviewer.submitted} onClick={() => void reassignReader(reviewer)} className="button-secondary text-xs whitespace-nowrap disabled:opacity-50">
                        Reassign open packets
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" disabled={pending || reviewsLeft > 0} onClick={() => void act({ action: "FREEZE", batchId: batch.id }, "Review closed. Ranking is below.")} className="button-primary mt-4 disabled:opacity-50">
              Close review and rank
            </button>
            {reviewsLeft > 0 && <p className="mt-2 text-xs text-mecg-navy/55">Waiting on {reviewsLeft} review{reviewsLeft === 1 ? "" : "s"}.</p>}
            {step4State === "active" && notices}
          </>
        )}
      </Step>
    </ol>
  );
}
