"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

  async function act(payload: Record<string, unknown>) {
    setPending(true);
    setError("");
    const response = await fetch("/api/admin/screening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleId, ...payload }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error ?? "Request failed");
    else router.refresh();
    setPending(false);
  }

  if (!batchId) {
    return (
      <section className="rounded-2xl border border-mecg-navy/10 p-6">
        <h2 className="text-xl font-semibold">Choose blind reviewers</h2>
        <p className="mt-2 text-sm text-mecg-navy/60">Only ordinary Members can review. Board, Panel, and Owner accounts remain identity stewards.</p>
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
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      </section>
    );
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-mecg-navy/10 p-5">
      {status === "DRAFT" && <button type="button" disabled={pending} onClick={() => void act({ action: "DISTRIBUTE", batchId })} className="button-primary">Distribute approved packets</button>}
      {status === "PUBLISHED" && <button type="button" disabled={pending} onClick={() => void act({ action: "FREEZE", batchId })} className="button-primary">Freeze completed screening</button>}
      <p className="text-sm text-mecg-navy/60">Batch status: {status}</p>
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </section>
  );
}
