"use client";

import { useState } from "react";
import { useAction } from "@/lib/use-action";
import OperationNotice from "@/components/operation-notice";
import { ONBOARDING_LABELS, type ApplicantOnboardingItem } from "./onboarding-data";

export default function ApplicantOnboarding({ items }: { items: ApplicantOnboardingItem[] }) {
  const { pending, error, success, run } = useAction("/applicant/onboarding", "Could not update onboarding. Try again.");
  const [completed, setCompleted] = useState(() => new Set(items.filter((item) => item.completedAt).map((item) => item.key)));
  const done = completed.size;
  const yourItems = items.filter((item) => ONBOARDING_LABELS[item.key]?.selfCompletable);
  const boardItems = items.filter((item) => !ONBOARDING_LABELS[item.key]?.selfCompletable);
  const yourRemaining = yourItems.filter((item) => !completed.has(item.key)).length;
  const groups = [{ title: "Your steps", items: yourItems }, { title: "MECG is arranging", items: boardItems }];

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
    <section id="member-onboarding" className="scroll-mt-6 rounded-xl bg-white p-5 inset-ring inset-ring-line sm:p-6" aria-labelledby="onboarding-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-mecg-orange-ink">Accepted · Member onboarding</p>
          <h2 id="onboarding-title" className="mt-2 text-xl font-semibold">{done} of {items.length} steps complete</h2>
        </div>
        <span className="tabular text-sm font-semibold text-muted">{Math.round((done / items.length) * 100)}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-mecg-navy/10" aria-hidden="true"><div className="h-full bg-mecg-orange" style={{ width: `${(done / items.length) * 100}%` }} /></div>
      {yourRemaining === 0 && yourItems.length > 0 && <p className="mt-4 text-sm text-muted">Your steps are complete. Any unfinished Board steps are listed below.</p>}
      {groups.filter((group) => group.items.length > 0).map((group) => <div key={group.title} className="mt-5">
      <h3 className="text-sm font-semibold">{group.title}</h3>
      <ol className="mt-2 grid gap-2">
        {group.items.map((item) => {
          const copy = ONBOARDING_LABELS[item.key] ?? { title: item.key, detail: "", selfCompletable: false };
          const isDone = completed.has(item.key);
          return (
            <li key={item.key} className="flex flex-col gap-3 rounded-xl bg-wash p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-mecg-navy">{isDone ? "✓ " : ""}{copy.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{item.key === "CONTACT_CONFIRMATION" && item.contact ? `Contact on file: ${item.contact}. ` : ""}{copy.detail}{item.ownerName && !isDone ? ` Owner: ${item.ownerName}.` : ""}</p>
              </div>
              {copy.selfCompletable ? (
                <button type="button" disabled={pending} onClick={() => void toggle(item)} className={isDone ? "button-secondary min-h-11 shrink-0" : "button-primary min-h-11 shrink-0"}>
                  {isDone ? "Mark incomplete" : "Mark complete"}
                </button>
              ) : <span className="shrink-0 text-xs font-semibold text-muted">{isDone ? "Complete" : "Board action"}</span>}
            </li>
          );
        })}
      </ol>
      </div>)}
      <div className="mt-3 space-y-2"><OperationNotice kind="error">{error}</OperationNotice><OperationNotice kind="success">{success}</OperationNotice></div>
    </section>
  );
}
