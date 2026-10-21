"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setApplicantActionPending } from "./status-refresh";

type ScheduleAction = "CANCEL_RSVP" | "RESCHEDULE_RSVP" | "CANCEL_BUDDY" | "RESCHEDULE_BUDDY";

export default function ScheduleActionButton({ action, currentSlotId, nextSlotId, label, confirmationText }: { action: ScheduleAction; currentSlotId: string; nextSlotId?: string; label: string; confirmationText?: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const headingRef = useRef<HTMLParagraphElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (confirming) headingRef.current?.focus();
  }, [confirming]);

  function keepCurrent() {
    setConfirming(false);
    setError("");
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
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
      inFlight.current = false;
      setPending(false);
      setApplicantActionPending(false);
    }
  }

  if (!confirming) return <button ref={triggerRef} type="button" onClick={() => setConfirming(true)} className="button-secondary min-h-11 text-sm">{label}</button>;
  return (
    <div className="rounded-xl bg-white p-3 inset-ring inset-ring-line">
      <p ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-mecg-navy">{action.startsWith("CANCEL") ? "Cancel this booking?" : "Change to this time?"}</p>
      {confirmationText && <p className="mt-2 text-sm leading-6 text-muted">{confirmationText}</p>}
      <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={pending} onClick={() => void submit()} className="button-primary min-h-11 text-xs">{pending ? "Saving…" : action.startsWith("CANCEL") ? "Confirm cancellation" : "Confirm new time"}</button><button type="button" disabled={pending} onClick={keepCurrent} className="button-secondary min-h-11 text-xs">Keep current</button></div>
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
