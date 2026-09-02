"use client";

import { useAction } from "@/lib/use-action";
import OperationNotice from "@/components/operation-notice";

export default function GradingToggle({ eventId, cycleId, enabled }: { eventId: string; cycleId: string; enabled: boolean }) {
  const { pending: busy, error, success, run } = useAction("/api/admin/rush", "Could not update member observations.");

  async function handleToggle() {
    if (busy) return;
    await run(
      { action: "SET_EVENT_GRADING", cycleId, eventId, enabled: !enabled },
      { successMessage: `Member observations ${enabled ? "disabled" : "enabled"}.` },
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={busy}
        className="button-secondary text-sm"
      >
        {busy ? "Saving…" : enabled ? "Disable member observations" : "Enable member observations"}
      </button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </div>
  );
}
