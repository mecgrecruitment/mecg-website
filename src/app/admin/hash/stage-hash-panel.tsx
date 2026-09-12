"use client";

import Link from "next/link";
import { useAction } from "@/lib/use-action";
import { HASH_STAGES, HASH_STAGE_RULES, hashOutcome, type HashStage } from "@/lib/hash-tally";
import { applicationStatusLabel, hashStageLabel } from "@/lib/labels";
import OperationNotice from "@/components/operation-notice";
import { MemberNotes, MemberVote, type HashTallyRow } from "./member-vote";

export type StageHashRow = { id: string; displayName: string; tally: HashTallyRow | undefined; notes: string[] };

const STAGE_LABELS = { pass: "Advance", fail: "Reject" };

// A stage hash is opened, applied, and closed from here. The RPCs recompute the
// tally and re-check the stage, so a stale page cannot move the wrong applicant.
export default function StageHashPanel({
  cycleId,
  stage,
  quorum,
  eligibleVoters,
  ballotCounts,
  rows,
  canManageCycle,
}: {
  cycleId: string;
  stage: HashStage | null;
  quorum: number;
  eligibleVoters: number;
  ballotCounts: Record<HashStage, number>;
  rows: StageHashRow[];
  canManageCycle: boolean;
}) {
  const { pending, error, success, run } = useAction("/api/admin/rush", "Could not update the stage vote. Check your connection and try again.");

  if (!stage) {
    if (!canManageCycle) return null;
    const open = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      await run({ action: "SET_HASH_STAGE", cycleId, stage: data.get("stage"), quorum: Number(data.get("quorum")) }, { successMessage: "Stage vote opened.", fallbackError: "Could not open the vote" });
    };
    return (
      <section aria-labelledby="stage-hash-heading">
        <h2 id="stage-hash-heading" className="text-xl font-semibold text-mecg-navy">Stage vote</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-mecg-navy/55">Open a hash on one pipeline stage. YES moves the applicant forward, NO or a tie rejects them.</p>
        <form onSubmit={open} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">Stage
            <select name="stage" required disabled={pending} className="select-control mt-2 text-sm">
              {HASH_STAGES.map((candidate) => (
                <option key={candidate} value={candidate} disabled={!ballotCounts[candidate]}>{hashStageLabel(candidate)} · {ballotCounts[candidate]} on the ballot</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">Quorum
            <input name="quorum" type="number" min={1} max={500} required defaultValue={quorum || 1} disabled={pending} className="field-control mt-2 w-28 text-sm" />
          </label>
          <button type="submit" disabled={pending} className="button-primary text-sm">{pending ? "Opening…" : "Open vote"}</button>
        </form>
        <OperationNotice kind="error">{error}</OperationNotice>
        <OperationNotice kind="success">{success}</OperationNotice>
      </section>
    );
  }

  const rule = HASH_STAGE_RULES[stage];
  const decided = rows.filter((row) => row.tally && hashOutcome(row.tally.quorum, row.tally.yes_count, row.tally.no_count, row.tally.total_votes) !== "PENDING");
  async function apply(applicationId?: string) {
    if (pending || !window.confirm(applicationId ? "Apply the vote for this applicant? Their status changes now." : `Apply every decided vote (${decided.length})? Statuses change now.`)) return;
    await run({ action: "APPLY_STAGE_HASH", cycleId, applicationId }, { successMessage: "Vote result applied.", fallbackError: "Could not apply the result" });
  }
  async function close() {
    if (pending || !window.confirm("Close this stage vote? Votes stay recorded, but nobody can vote or apply results until a stage is opened again.")) return;
    await run({ action: "SET_HASH_STAGE", cycleId, stage: null }, { successMessage: "Stage vote closed.", fallbackError: "Could not close the vote" });
  }

  return (
    <section aria-labelledby="stage-hash-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="stage-hash-heading" className="text-xl font-semibold text-mecg-navy">{hashStageLabel(stage)} hash · <span className="tabular">{rows.length}</span> on the ballot · quorum <span className="tabular">{quorum}</span> · <span className="tabular">{eligibleVoters}</span> eligible voters</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-mecg-navy/55">YES sends them to {applicationStatusLabel(rule.pass)}, NO rejects.</p>
        </div>
        {canManageCycle && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending || !decided.length} onClick={() => void apply()} className="button-primary text-sm">Apply all decided ({decided.length})</button>
            <button type="button" disabled={pending} onClick={() => void close()} className="button-secondary text-sm">Close vote</button>
          </div>
        )}
      </div>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
      <div className="mt-4 divide-y divide-mecg-navy/[0.08] border-y border-mecg-navy/[0.1]">
        {rows.map((row) => {
          const outcome = row.tally ? hashOutcome(row.tally.quorum, row.tally.yes_count, row.tally.no_count, row.tally.total_votes) : "PENDING";
          return (
            <article key={row.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(10rem,1fr)_minmax(12rem,1fr)_auto] sm:items-start sm:gap-4">
              <Link href={`/admin/applications/${row.id}`} className="font-semibold text-mecg-navy underline decoration-mecg-navy/25 underline-offset-2">{row.displayName}</Link>
              <MemberVote tally={row.tally} labels={STAGE_LABELS} />
              {canManageCycle && <button type="button" disabled={pending || outcome === "PENDING"} onClick={() => void apply(row.id)} className="button-secondary text-sm">Apply</button>}
              {row.notes.length > 0 && <div className="sm:col-span-3"><MemberNotes notes={row.notes} /></div>}
            </article>
          );
        })}
        {!rows.length && <p className="py-3 text-sm text-mecg-navy/55">Nobody is on this ballot.</p>}
      </div>
    </section>
  );
}
