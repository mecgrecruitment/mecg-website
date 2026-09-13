"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authorizedFetch } from "@/lib/client-fetch";

export default function RetryButton({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function retry() {
    setPending(true);
    setMessage("");
    try {
      const response = await authorizedFetch("/api/admin/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      const body = await response.json().catch(() => ({})) as { delivered?: boolean; status?: string; error?: string };
      if (!response.ok && response.status !== 202) throw new Error(body.error ?? "Retry failed");
      setMessage(body.delivered ? "Delivered" : body.status === "PENDING" ? "Queued" : "Not delivered");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retry failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" className="button-secondary text-xs" disabled={pending} onClick={retry}>
        {pending ? "Retrying…" : "Retry"}
      </button>
      <span aria-live="polite" className="text-xs text-mecg-navy/55">{message}</span>
    </div>
  );
}
