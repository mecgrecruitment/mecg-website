"use client";

import { useAction } from "@/lib/use-action";
import OperationNotice from "@/components/operation-notice";

// The board applies the members' vote, it does not author the outcome. The RPC
// recomputes the tally, so a stale page cannot apply the wrong result.
export default function ApplyResultForm({ applicationId }: { applicationId: string }) {
  const { pending, error, success, run } = useAction("/api/admin/hash-results", "Could not apply the result. Check your connection and try again.");
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
