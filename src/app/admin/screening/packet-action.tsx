"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PacketAction({ cycleId, packetId, status, responses }: { cycleId: string; packetId: string; status: string; responses: Array<{ question?: string; answer?: string }> }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState(responses.map((response) => response.answer ?? ""));
  async function decide(approved: boolean) {
    setPending(true);
    setError("");
    const response = await fetch("/api/admin/screening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cycleId, action: "APPROVE_PACKET", packetId, approved }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error ?? "Could not update packet"); else router.refresh();
    setPending(false);
  }
  async function saveRedaction() {
    setPending(true);
    setError("");
    const content = { responses: responses.map((response, index) => ({ question: response.question ?? "", answer: answers[index] ?? "" })) };
    const response = await fetch("/api/admin/screening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cycleId, action: "UPDATE_PACKET", packetId, content }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error ?? "Could not save redaction"); else router.refresh();
    setPending(false);
  }
  return (
    <div className="mt-4 space-y-3">
      <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-medium">Edit redacted answers</summary><div className="mt-3 space-y-3">{responses.map((response, index) => <label key={index} className="block text-xs font-medium">{response.question}<textarea value={answers[index]} onChange={(event) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))} className="mt-1 min-h-24 w-full rounded border px-3 py-2 text-sm font-normal" /></label>)}<button type="button" disabled={pending} onClick={() => void saveRedaction()} className="button-secondary">Save redaction</button></div></details>
      <div className="flex flex-wrap gap-2"><button disabled={pending || status === "APPROVED"} onClick={() => void decide(true)} className="button-primary">Approve blind packet</button><button disabled={pending || status === "REJECTED"} onClick={() => void decide(false)} className="button-secondary">Reject for redaction</button></div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
