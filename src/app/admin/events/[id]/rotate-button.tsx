"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RotateButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleRotate() {
    if (!confirm("Rotate the QR code? The old code will stop working.")) return;
    setBusy(true);
    await fetch(`/api/admin/events/${eventId}/rotate`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleRotate}
      disabled={busy}
      className="border rounded px-3 py-2 text-sm disabled:opacity-50"
    >
      {busy ? "Rotating..." : "Rotate QR code"}
    </button>
  );
}
