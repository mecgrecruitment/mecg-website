"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DecisionForm({ cycleId, applicationId }: { cycleId: string; applicationId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE", cycleId, applicationId, outcome: data.get("outcome"), reason: data.get("reason") }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error ?? "Could not create decision");
    else router.refresh();
    setPending(false);
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <select name="outcome" className="min-h-[30px] rounded-full bg-mecg-navy/[0.035] px-3 text-xs font-medium text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]">
        <option>OFFER</option>
        <option>WAITLIST</option>
        <option>REJECT</option>
        <option>PROCEDURAL_REVIEW</option>
      </select>
      <input name="reason" required placeholder="Evidence-based reason" className="min-h-[30px] w-full rounded-full bg-mecg-navy/[0.035] px-3 text-xs shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]" />
      <button disabled={pending} className="self-start rounded-full bg-mecg-navy px-3 py-1 text-xs font-semibold text-white hover:bg-mecg-navy/90 disabled:opacity-50">Recommend</button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </form>
  );
}

export function ApprovalButton({ decisionId }: { decisionId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function approve() {
    const response = await fetch("/api/admin/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "APPROVE", decisionId }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error ?? "Could not approve"); else router.refresh();
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={approve} className="rounded-full px-3 py-1 text-xs font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.12]">Approve</button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function PreviewForm({ decisionId, current }: { decisionId: string; current?: string | null }) {
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void fetch("/api/admin/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "PREVIEW", decisionId, preview: data.get("preview") }) }).then(() => router.refresh()); }}
    >
      <textarea name="preview" defaultValue={current ?? ""} placeholder="Email preview. Release still requires two approvals." className="min-h-16 w-full rounded-xl bg-mecg-navy/[0.035] p-2.5 text-xs shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]" />
      <button className="self-start rounded-full px-3 py-1 text-xs font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.12]">Save preview</button>
    </form>
  );
}

export function ReleaseButton({ decisionId }: { decisionId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function release() {
    const response = await fetch("/api/admin/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "RELEASE", decisionId }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error ?? "Could not release"); else router.refresh();
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={release} className="rounded-full bg-mecg-navy px-3 py-1 text-xs font-semibold text-white hover:bg-mecg-navy/90">Release outcome</button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
