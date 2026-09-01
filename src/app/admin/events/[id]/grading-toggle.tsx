"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";

export default function GradingToggle({ eventId, cycleId, enabled }: { eventId: string; cycleId: string; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleToggle() {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_EVENT_GRADING", cycleId, eventId, enabled: !enabled }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Could not update member grading.");
        return;
      }
      setSuccess(`Member grading ${enabled ? "disabled" : "enabled"}.`);
      router.refresh();
    } catch {
      setError("Could not update member grading.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={busy}
        className="button-secondary text-sm"
      >
        {busy ? "Saving..." : enabled ? "Disable member grading" : "Enable member grading"}
      </button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </div>
  );
}
