"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";

export default function ConflictForm({ applications }: { applications: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("Declaring a conflict is irreversible: it voids your existing evaluation work for this applicant and cannot be undone. Continue?")) return;
    setError("");
    setMessage("");
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/member/conflicts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: data.get("applicationId"), reason: data.get("reason") }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not declare conflict");
      } else {
        event.currentTarget.reset();
        setMessage("Conflict declared. This applicant has been removed from your work queue.");
        router.refresh();
      }
    } catch {
      setError("Could not declare conflict. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-paper p-5 sm:p-6">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mecg-orange-ink">Safety and fairness</p>
      <h3 className="mt-2 text-lg font-semibold text-mecg-navy">Declare a conflict</h3>
      <p className="mt-1 text-sm leading-6 text-mecg-navy/55">This immediately removes you from this applicant’s evaluations and decision approvals. Existing evaluation work is voided, and you cannot score this applicant afterward.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="conflict-applicationId">Applicant to recuse from</label>
        <select id="conflict-applicationId" name="applicationId" required disabled={pending} className="min-h-11 rounded-xl bg-white px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]">
          <option value="">Applicant</option>
          {applications.map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="conflict-reason">Relationship or conflict reason</label>
        <input id="conflict-reason" name="reason" required maxLength={1000} disabled={pending} placeholder="Relationship or conflict" className="min-h-11 min-w-56 flex-1 rounded-xl bg-white px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]" />
        <button disabled={pending} className="button-primary">{pending ? "Declaring…" : "Declare conflict"}</button>
      </div>
      <div className="mt-3 space-y-2">
        <OperationNotice kind="error">{error}</OperationNotice>
        <OperationNotice kind="success">{message}</OperationNotice>
      </div>
    </form>
  );
}
