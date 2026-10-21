"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "@/lib/use-action";
import { runAction } from "@/lib/run-action";
import OperationNotice from "@/components/operation-notice";
import { applyFinalPlan, finalApplyChangeMessage, finalApplyConfirmMessage, type FinalApplyPlan, type FinalApplyReport } from "./final-apply";

const ENDPOINT = "/api/admin/hash-results";
const FALLBACK = "Could not apply the result. Check your connection and try again.";

// The board applies the members' vote, it does not author the outcome. The RPC
// recomputes the tally, so a stale page cannot apply the wrong result.
export default function ApplyResultForm({ applicationId }: { applicationId: string }) {
  const { pending, error, success, run } = useAction(ENDPOINT, FALLBACK);
  async function apply() {
    if (pending || !window.confirm("Apply the members' vote for this applicant? The outcome is recorded and locked.")) return;
    await run({ applicationId }, { successMessage: "Vote result applied and locked.", fallbackError: "Could not apply the result" });
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" disabled={pending} onClick={apply} className="button-primary text-sm">{pending ? "Applying…" : "Apply the vote result"}</button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </div>
  );
}

export function ApplyAllFinalButton({ plan }: { plan: FinalApplyPlan }) {
  const router = useRouter();
  const [done, setDone] = useState<number | null>(null);
  const [report, setReport] = useState<FinalApplyReport | null>(null);
  const running = done !== null;
  async function applyAll() {
    if (running || !plan.items.length || !window.confirm(finalApplyConfirmMessage(plan))) return;
    setReport(null);
    setDone(0);
    const result = await applyFinalPlan(plan.items, async (applicationId) => {
      const response = await runAction(ENDPOINT, { applicationId }, FALLBACK);
      if (!response.ok) return { ok: false, error: response.error };
      const outcome = (response.body as { outcome?: unknown } | null)?.outcome;
      return { ok: true, outcome: typeof outcome === "string" ? outcome : null };
    }, setDone);
    setReport(result);
    setDone(null);
    router.refresh();
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" disabled={running || !plan.items.length} onClick={() => void applyAll()} className="button-primary text-sm">
        {running ? `Applying ${done} of ${plan.items.length}…` : `Apply all decided (${plan.items.length})`}
      </button>
      {report && report.applied > 0 && <OperationNotice kind="success">{report.applied} vote result{report.applied === 1 ? "" : "s"} applied and locked.</OperationNotice>}
      {plan.conflictSkipped > 0 && <p className="text-xs text-muted">{plan.conflictSkipped} skipped: you declared a conflict.</p>}
      {report && report.changes.length > 0 && (
        <OperationNotice kind="info">
          {report.changes.length} applied differently than shown: {report.changes.map(finalApplyChangeMessage).join("; ")}.
        </OperationNotice>
      )}
      {report && report.failures.length > 0 && (
        <OperationNotice kind="error">
          {report.failures.length} could not be applied: {report.failures.map((failure) => `${failure.displayName} (${failure.error})`).join("; ")}.
        </OperationNotice>
      )}
    </div>
  );
}
