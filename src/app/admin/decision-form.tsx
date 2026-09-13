"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "@/lib/use-action";
import { detroitDateTimeToIso, formatDetroitDateTime } from "@/lib/detroit-date-time";
import { decisionOutcomeLabel } from "@/lib/labels";
import OperationNotice from "@/components/operation-notice";
import { authorizedFetch } from "@/lib/client-fetch";

const DECISION_OUTCOMES = ["OFFER", "WAITLIST", "REJECT", "PROCEDURAL_REVIEW"] as const;

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
      <select id={`outcome-${applicationId}`} name="outcome" disabled={pending} className="select-control text-xs">
        {/* The value is set explicitly: without it the option's visible text is
            what the form posts, so humanizing the label would have changed the
            outcome sent to the server. */}
        {DECISION_OUTCOMES.map((outcome) => (
          <option key={outcome} value={outcome}>{decisionOutcomeLabel(outcome)}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`reason-${applicationId}`}>Evidence-based reason</label>
      <input id={`reason-${applicationId}`} name="reason" required disabled={pending} placeholder="Evidence-based reason" className="operation-control min-h-11 w-full rounded-xl bg-mecg-navy/[0.035] px-3 text-xs shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)] disabled:opacity-60" />
      <button type="submit" disabled={pending} className="button-primary self-start text-xs">{pending ? "Creating…" : "Recommend"}</button>
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
      <label className="sr-only" htmlFor={`preview-${decisionId}`}>Applicant email preview</label>
      <textarea id={`preview-${decisionId}`} name="preview" disabled={pending} defaultValue={current ?? ""} placeholder="Email preview. Release still requires two approvals." className="min-h-24 w-full rounded-xl bg-mecg-navy/[0.035] p-2.5 text-xs shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)] disabled:opacity-60" />
      <button type="submit" disabled={pending} className="button-secondary self-start text-xs">
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

// Decision night was sixty separate Release clicks, each of which could half
// fail with no record of how far the board got. This releases everything the
// single-decision path would accept and reports what it skipped.
export function ReleaseAllButton({ cycleId, readyCount }: { cycleId: string; readyCount: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState("");

  async function releaseAll() {
    if (pending || !window.confirm(`Release ${readyCount} locked outcome${readyCount === 1 ? "" : "s"} to applicants now? This cannot be undone.`)) return;
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const response = await authorizedFetch("/api/admin/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RELEASE_ALL", cycleId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Could not release the outcomes");
        return;
      }
      const body = await response.json().catch(() => null);
      const released = Number(body?.released ?? 0);
      const skipped = Number(body?.skipped ?? 0);
      setSuccess(skipped
        ? `Released ${released} and queued their emails. Skipped ${skipped} that were not ready or that you are conflicted on.`
        : `Released ${released} outcome${released === 1 ? "" : "s"}; applicant emails are queued for delivery.`);
      router.refresh();
    } catch {
      setError("Could not release the outcomes. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (!readyCount) return null;
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" disabled={pending} onClick={releaseAll} className="button-primary text-sm">
        {pending ? "Releasing…" : `Release all ${readyCount} locked outcomes`}
      </button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </div>
  );
}

// An offer with no deadline leaves the cohort open indefinitely. The RPC
// enforces expiry in respond_to_offer, so this only has to collect the date.
export function OfferDeadlineForm({ applicationId, current }: { applicationId: string; current: string | null }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState("");

  async function save(form: HTMLFormElement) {
    const value = String(new FormData(form).get("expiresAt") ?? "");
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const expiresAt = value ? detroitDateTimeToIso(value, current ?? undefined) : "";
      const response = await authorizedFetch("/api/admin/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_DEADLINE", applicationId, expiresAt }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Could not set the deadline");
        return;
      }
      setSuccess(value ? "Deadline saved." : "Deadline cleared.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not set the deadline");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="flex flex-col items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save(event.currentTarget);
      }}
    >
      <label className="text-xs font-semibold text-mecg-navy/60">
        Offer deadline (Detroit time)
        <input
          type="datetime-local"
          name="expiresAt"
          defaultValue={current ? formatDetroitDateTime(current) : ""}
          className="mt-1.5 block min-h-10 rounded-xl bg-mecg-navy/[0.035] px-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none"
        />
      </label>
      <button type="submit" disabled={pending} className="button-secondary text-xs">
        {pending ? "Saving…" : "Save deadline"}
      </button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </form>
  );
}
