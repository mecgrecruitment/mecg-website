"use client";

import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { useAction } from "@/lib/use-action";
import OperationNotice from "@/components/operation-notice";

export default function RotateButton({ eventId, cycleId }: { eventId: string; cycleId: string }) {
  const { pending: busy, error, success, run, router, setError } = useAction(`/api/admin/events/${eventId}/rotate`, "Could not rotate the QR code.");

  async function handleRotate() {
    if (busy) return;
    if (!confirm("Rotate the QR code? The old code will stop working.")) return;
    const result = await run(
      {},
      { skipRefresh: true, fallbackError: "Could not rotate the QR code.", successMessage: "QR code rotated. The previous code no longer works." },
    );
    if (!result.ok) return;
    const token = (result.body as { checkinToken?: string } | null)?.checkinToken;
    if (!token) {
      setError("Could not rotate the QR code.");
      return;
    }
    router.replace(withWorkspaceCycle(`/admin/events/${eventId}?token=${encodeURIComponent(token)}`, cycleId));
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleRotate}
        disabled={busy}
        className="button-secondary text-sm"
      >
        {busy ? "Rotating…" : "Rotate QR code"}
      </button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </div>
  );
}
