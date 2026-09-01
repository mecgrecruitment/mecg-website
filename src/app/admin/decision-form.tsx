"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";

export default function DecisionForm({ cycleId, applicationId }: { cycleId: string; applicationId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/admin/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE", cycleId, applicationId, outcome: data.get("outcome"), reason: data.get("reason") }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not create decision");
        return;
      }
      setSuccess("Decision recommendation created.");
      router.refresh();
    } catch {
      setError("Could not create decision. Check your connection and try again.");
    } finally {
      setPending(false);
    }
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
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState("");
  async function approve() {
    if (pending || !window.confirm("Approve this recommendation? A second approval locks it for release.")) return;
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "APPROVE", decisionId }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not approve");
        return;
      }
      setSuccess("Approval recorded.");
      router.refresh();
    } catch {
      setError("Could not record approval. Check your connection and try again.");
    } finally {
      setPending(false);
    }
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
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/admin/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "PREVIEW", cycleId, decisionId, preview: data.get("preview") }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not save preview");
        return;
      }
      setSuccess("Release preview saved.");
      router.refresh();
    } catch {
      setError("Could not save preview. Check your connection and try again.");
    } finally {
      setPending(false);
    }
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
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState("");
  async function release() {
    if (pending || !window.confirm("Release this outcome to the applicant now? This cannot be undone.")) return;
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "RELEASE", decisionId }) });
      const body = await response.json().catch(() => null);
    // A 502 with released:true means the outcome IS released and only the
    // applicant email failed. Refresh anyway, or the board sees a stale LOCKED
    // row and clicks Release a second time.
      if (!response.ok) {
        setError(body?.error ?? "Could not release");
        if (body?.released === true) router.refresh();
        return;
      }
      setSuccess("Outcome released to the applicant.");
      router.refresh();
    } catch {
      setError("Could not release outcome. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" disabled={pending} onClick={release} className="button-primary text-xs">{pending ? "Releasing…" : "Release outcome"}</button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </div>
  );
}
