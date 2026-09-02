"use client";

import { useState } from "react";
import { useAction } from "@/lib/use-action";
import OperationNotice from "@/components/operation-notice";
import { ONBOARDING_LABELS, type ApplicantOnboardingItem } from "./onboarding-data";

export default function ApplicantOnboarding({ items }: { items: ApplicantOnboardingItem[] }) {
  const { pending, error, success, run } = useAction("/applicant/onboarding", "Could not update onboarding. Try again.");
  const [completed, setCompleted] = useState(() => new Set(items.filter((item) => item.completedAt).map((item) => item.key)));
  const done = completed.size;

  async function toggle(item: ApplicantOnboardingItem) {
    const next = !completed.has(item.key);
    const result = await run({ applicationId: item.applicationId, itemKey: item.key, complete: next }, { successMessage: "Onboarding progress saved." });
    if (!result.ok) return;
    setCompleted((current) => {
      const updated = new Set(current);
      if (next) updated.add(item.key); else updated.delete(item.key);
      return updated;
    });
  }

  return (
    <section id="member-onboarding" className="scroll-mt-6 rounded-2xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-6" aria-labelledby="onboarding-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-mecg-orange-ink">Accepted · Member onboarding</p>
          <h2 id="onboarding-title" className="mt-2 text-xl font-semibold">{done} of {items.length} steps complete</h2>
        </div>
        <span className="tabular text-sm font-semibold text-mecg-navy/60">{Math.round((done / items.length) * 100)}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-mecg-navy/10" aria-hidden="true"><div className="h-full bg-mecg-orange" style={{ width: `${(done / items.length) * 100}%` }} /></div>
      <ol className="mt-4 grid gap-2">
        {items.map((item) => {
          const copy = ONBOARDING_LABELS[item.key] ?? { title: item.key, detail: "", selfCompletable: false };
          const isDone = completed.has(item.key);
          return (
            <li key={item.key} className="flex flex-col gap-3 rounded-xl bg-mecg-navy/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-mecg-navy">{isDone ? "✓ " : ""}{copy.title}</p>
                <p className="mt-1 text-xs leading-5 text-mecg-navy/60">{item.key === "CONTACT_CONFIRMATION" && item.contact ? `Contact on file: ${item.contact}. ` : ""}{copy.detail}{item.ownerName && !isDone ? ` Owner: ${item.ownerName}.` : ""}</p>
              </div>
              {copy.selfCompletable ? (
                <button type="button" disabled={pending} onClick={() => void toggle(item)} className={isDone ? "button-secondary min-h-11 shrink-0" : "button-primary min-h-11 shrink-0"}>
                  {isDone ? "Mark incomplete" : "Mark complete"}
                </button>
              ) : <span className="shrink-0 text-xs font-semibold text-mecg-navy/50">{isDone ? "Complete" : "Board action"}</span>}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 space-y-2"><OperationNotice kind="error">{error}</OperationNotice><OperationNotice kind="success">{success}</OperationNotice></div>
    </section>
  );
}
