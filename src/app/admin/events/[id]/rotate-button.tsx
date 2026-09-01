"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";

export default function RotateButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleRotate() {
    if (busy) return;
    if (!confirm("Rotate the QR code? The old code will stop working.")) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/rotate`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.checkinToken) {
        setError(data?.error ?? "Could not rotate the QR code.");
        return;
      }
      setSuccess("QR code rotated. The previous code no longer works.");
      router.replace(`/admin/events/${eventId}?token=${encodeURIComponent(data.checkinToken)}`);
    } catch {
      setError("Could not rotate the QR code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleRotate}
        disabled={busy}
        className="button-secondary text-sm"
      >
        {busy ? "Rotating..." : "Rotate QR code"}
      </button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </div>
  );
}
