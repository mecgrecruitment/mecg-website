"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import OperationNotice from "@/components/operation-notice";

export default function ScreeningControls({
  cycleId,
  members,
  batchId,
  status,
}: {
  cycleId: string;
  members: Array<{ id: string; name: string }>;
  batchId?: string;
  status?: string;
}) {
  const router = useRouter();
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function act(payload: Record<string, unknown>) {
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/screening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, ...payload }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Request failed");
        return;
      }
      setSuccess(payload.action === "CREATE" ? "Screening packets created." : payload.action === "DISTRIBUTE" ? "Approved packets distributed." : "Completed screening frozen.");
      router.refresh();
    } catch {
      setError("Request failed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (!batchId) {
    return (
      <section className="rounded-2xl p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
        <h2 className="text-xl font-semibold">Choose blind reviewers</h2>
        <p className="mt-2 text-sm text-mecg-navy/55">Only ordinary Members can review. Board, Panel, and Owner accounts remain identity stewards.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {members.map((member) => {
            const checked = reviewerIds.includes(member.id);
            return (
              <label
                key={member.id}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  checked
                    ? "bg-mecg-orange/15 text-mecg-orange-ink shadow-[inset_0_0_0_1px_rgba(168,62,11,0.35)]"
                    : "text-mecg-navy/70 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.08]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setReviewerIds((current) => event.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id))}
                  className="sr-only"
                />
                {member.name}
              </label>
            );
          })}
        </div>
        <button type="button" disabled={pending || reviewerIds.length < 3} onClick={() => void act({ action: "CREATE", reviewerIds })} className="button-primary mt-5 disabled:opacity-50">Create packets for {reviewerIds.length} reviewers</button>
        <div className="mt-4 space-y-2"><OperationNotice kind="error">{error}</OperationNotice><OperationNotice kind="success">{success}</OperationNotice></div>
      </section>
    );
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
      {status === "DRAFT" && <button type="button" disabled={pending} onClick={() => void act({ action: "DISTRIBUTE", batchId })} className="button-primary">Distribute approved packets</button>}
      {status === "PUBLISHED" && <button type="button" disabled={pending} onClick={() => void act({ action: "FREEZE", batchId })} className="button-primary">Freeze completed screening</button>}
      <p className="text-sm text-mecg-navy/55">Batch status: {status}</p>
      <div className="w-full space-y-2"><OperationNotice kind="error">{error}</OperationNotice><OperationNotice kind="success">{success}</OperationNotice></div>
    </section>
  );
}
