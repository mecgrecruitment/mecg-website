"use client";

import { useAction } from "@/lib/use-action";
import OperationNotice from "@/components/operation-notice";

export default function DecisionForm({ cycleId, applicationId }: { cycleId: string; applicationId: string }) {
  const { pending, error, success, run } = useAction("/api/admin/decisions", "Could not create decision. Check your connection and try again.");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(
      { action: "CREATE", cycleId, applicationId, outcome: data.get("outcome"), reason: data.get("reason") },
      { successMessage: "Decision recommendation created.", fallbackError: "Could not create decision" },
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={`outcome-${applicationId}`}>
        Decision outcome
      </label>
      <select id={`outcome-${applicationId}`} name="outcome" disabled={pending} className="operation-control min-h-11 rounded-full bg-mecg-navy/[0.035] px-3 text-xs font-medium text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)] disabled:opacity-60">
        <option>OFFER</option>
        <option>WAITLIST</option>
        <option>REJECT</option>
        <option>PROCEDURAL_REVIEW</option>
      </select>
      <input name="reason" required disabled={pending} placeholder="Evidence-based reason" className="operation-control min-h-11 w-full rounded-xl bg-mecg-navy/[0.035] px-3 text-xs shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)] disabled:opacity-60" />
      <button disabled={pending} className="button-primary self-start text-xs">{pending ? "Creating…" : "Recommend"}</button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </form>
  );
}

export function ApprovalButton({ decisionId }: { decisionId: string }) {
  const { pending, error, success, run } = useAction("/api/admin/decisions", "Could not approve");
  async function approve() {
    if (pending || !window.confirm("Approve this recommendation? A second approval locks it for release.")) return;
    await run({ action: "APPROVE", decisionId }, { successMessage: "Approval recorded.", fallbackError: "Could not approve" });
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" disabled={pending} onClick={approve} className="button-secondary text-xs">{pending ? "Approving…" : "Approve"}</button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </div>
  );
}

export function PreviewForm({ decisionId, cycleId, current }: { decisionId: string; cycleId: string; current?: string | null }) {
  const { pending, error, success, run } = useAction("/api/admin/decisions", "Could not save preview. Check your connection and try again.");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(
      { action: "PREVIEW", cycleId, decisionId, preview: data.get("preview") },
      { successMessage: "Release preview saved.", fallbackError: "Could not save preview" },
    );
  }

  return (
    <form className="flex flex-col gap-1.5" onSubmit={submit}>
      <textarea name="preview" disabled={pending} defaultValue={current ?? ""} placeholder="Email preview. Release still requires two approvals." className="min-h-24 w-full rounded-xl bg-mecg-navy/[0.035] p-2.5 text-xs shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)] disabled:opacity-60" />
      <button disabled={pending} className="button-secondary self-start text-xs">
        {pending ? "Saving…" : "Save preview"}
      </button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </form>
  );
}

export function ReleaseButton({ decisionId }: { decisionId: string }) {
  const { pending, error, success, run, router } = useAction("/api/admin/decisions", "Could not release outcome. Check your connection and try again.");
  async function release() {
    if (pending || !window.confirm("Release this outcome to the applicant now? This cannot be undone.")) return;
    // A 502 with released:true means the outcome IS released and only the applicant email
    // failed. Refresh anyway, or the board sees a stale LOCKED row and clicks Release again.
    const result = await run(
      { action: "RELEASE", decisionId },
      { successMessage: "Outcome released to the applicant.", fallbackError: "Could not release", skipRefresh: true },
    );
    if (result.ok || (result.body as { released?: boolean } | null)?.released === true) router.refresh();
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" disabled={pending} onClick={release} className="button-primary text-xs">{pending ? "Releasing…" : "Release outcome"}</button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </div>
  );
}
