"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setApplicantActionPending } from "./status-refresh";

type ScheduleAction = "CANCEL_RSVP" | "RESCHEDULE_RSVP" | "CANCEL_BUDDY" | "RESCHEDULE_BUDDY";

export default function ScheduleActionButton({ action, currentSlotId, nextSlotId, label }: { action: ScheduleAction; currentSlotId: string; nextSlotId?: string; label: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setPending(true);
    setError("");
    setApplicantActionPending(true);
    try {
      const response = await fetch("/applicant/schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, currentSlotId, nextSlotId }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Could not update your schedule");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      params.set("action", "schedule");
      router.replace(`/applicant?${params.toString()}`, { scroll: false });
      router.refresh();
    } catch {
      setError("Could not update your schedule");
    } finally {
      setPending(false);
      setApplicantActionPending(false);
    }
  }

  if (!confirming) return <button type="button" onClick={() => setConfirming(true)} className="button-secondary min-h-11 text-sm">{label}</button>;
  return (
    <div className="rounded-xl bg-white p-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
      <p className="text-xs font-semibold text-mecg-navy">{action.startsWith("CANCEL") ? "Cancel this booking?" : "Change to this time?"}</p>
      <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={pending} onClick={() => void submit()} className="button-primary min-h-11 text-xs">{pending ? "Saving…" : "Confirm"}</button><button type="button" disabled={pending} onClick={() => setConfirming(false)} className="button-secondary min-h-11 text-xs">Keep current</button></div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
