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
  return <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2"><select name="outcome" className="rounded border px-2 py-1 text-sm"><option>OFFER</option><option>WAITLIST</option><option>REJECT</option><option>PROCEDURAL_REVIEW</option></select><input name="reason" required placeholder="Evidence-based reason" className="min-w-52 flex-1 rounded border px-2 py-1 text-sm" /><button disabled={pending} className="rounded bg-slate-950 px-3 py-1 text-sm text-white">Recommend</button>{error && <p className="w-full text-xs text-red-700">{error}</p>}</form>;
}

export function ApprovalButton({ decisionId }: { decisionId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function approve() {
    const response = await fetch("/api/admin/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "APPROVE", decisionId }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error ?? "Could not approve"); else router.refresh();
  }
  return <div><button onClick={approve} className="rounded border px-2 py-1 text-xs">Approve</button>{error && <p className="text-xs text-red-700">{error}</p>}</div>;
}

export function PreviewForm({ decisionId, current }: { decisionId: string; current?: string | null }) {
  const router = useRouter();
  return (
    <form className="mt-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void fetch("/api/admin/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "PREVIEW", decisionId, preview: data.get("preview") }) }).then(() => router.refresh()); }}>
      <textarea name="preview" defaultValue={current ?? ""} placeholder="Email preview. Release still requires two approvals." className="w-full rounded border p-2 text-xs" />
      <button className="mt-1 rounded border px-2 py-1 text-xs">Save preview</button>
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
  return <div><button onClick={release} className="rounded bg-slate-950 px-2 py-1 text-xs text-white">Release outcome</button>{error && <p className="text-xs text-red-700">{error}</p>}</div>;
}
