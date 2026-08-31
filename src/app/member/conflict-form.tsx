"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConflictForm({ applications }: { applications: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/member/conflicts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: data.get("applicationId"), reason: data.get("reason") }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "Could not declare conflict");
    } else {
      event.currentTarget.reset();
      setMessage("Conflict declared. You are recused from this applicant.");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-paper p-5 sm:p-6">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mecg-orange-ink">Safety and fairness</p>
      <h3 className="mt-2 text-lg font-semibold text-mecg-navy">Declare a conflict</h3>
      <p className="mt-1 text-sm leading-6 text-mecg-navy/55">This immediately recuses you from the applicant and any unfinished assignment.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="conflict-applicationId">Applicant</label>
        <select id="conflict-applicationId" name="applicationId" required className="min-h-11 rounded-xl bg-white px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]">
          <option value="">Applicant</option>
          {applications.map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="conflict-reason">Relationship or conflict</label>
        <input id="conflict-reason" name="reason" required placeholder="Relationship or conflict" className="min-h-11 min-w-56 flex-1 rounded-xl bg-white px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]" />
        <button className="button-primary">Declare</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {message && <p className="mt-2 text-sm font-medium text-green-800">{message}</p>}
    </form>
  );
}
