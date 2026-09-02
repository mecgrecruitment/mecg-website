"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";

export default function CalibrationForm({ roundId, rubricId, returnTo }: {
  roundId: string;
  rubricId: string;
  returnTo: string;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) {
      setError("Confirm that you reviewed the active rubric before continuing.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/member/calibration/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId, rubricId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Calibration acknowledgement could not be saved.");
        setPending(false);
        return;
      }
      router.push(returnTo);
      router.refresh();
    } catch {
      setError("Calibration acknowledgement could not be saved. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-2xl bg-paper p-5 sm:p-6">
      <label className="flex items-start gap-3 text-sm leading-6 text-mecg-navy/75">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => { setConfirmed(event.target.checked); setError(""); }}
          className="mt-1 h-4 w-4 accent-mecg-navy"
        />
        <span>I reviewed this rubric version and will score only observable evidence using these anchors.</span>
      </label>
      <p className="mt-3 text-xs leading-5 text-mecg-navy/55">
        Calibration is advisory. It never changes, normalizes, or automatically adjusts your scores.
      </p>
      <OperationNotice kind="error">{error}</OperationNotice>
      <button type="submit" disabled={pending} className="button-primary mt-4 disabled:opacity-50">
        {pending ? "Saving…" : "Acknowledge and return to My Work"}
      </button>
    </form>
  );
}
