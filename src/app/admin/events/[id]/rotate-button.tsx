"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RotateButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleRotate() {
    if (busy) return;
    if (!confirm("Rotate the QR code? The old code will stop working.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/rotate`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.checkinToken) {
        setError(data?.error ?? "Could not rotate the QR code.");
        return;
      }
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
        className="border rounded px-3 py-2 text-sm disabled:opacity-50"
      >
        {busy ? "Rotating..." : "Rotate QR code"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
