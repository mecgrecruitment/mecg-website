"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import { notificationReceipt, notificationStatusMessage } from "./retry-receipt";

type RetryState = "ready" | "sending" | "unconfirmed" | "checking" | "finished";

export default function RetryButton({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [state, setState] = useState<RetryState>("ready");
  const [message, setMessage] = useState("");
  const busy = state === "sending" || state === "checking";

  async function retry() {
    if (state !== "ready") return;
    setState("sending");
    setMessage("Requesting a retry for this email…");
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/admin/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notificationId }),
      }, 15_000, authorizedFetch);
      const receipt = response.ok ? notificationReceipt(body, notificationId) : null;
      if (!receipt || receipt.status === "UNCONFIRMED" || receipt.status === "NOT_DUE") {
        setState("unconfirmed");
        setMessage(notificationStatusMessage(receipt?.status ?? "UNCONFIRMED"));
        return;
      }
      setMessage(notificationStatusMessage(receipt.status));
      setState(receipt.status === "FAILED" ? "ready" : "finished");
      router.refresh();
    } catch {
      setState("unconfirmed");
      setMessage(notificationStatusMessage("UNCONFIRMED"));
    }
  }

  async function checkStatus() {
    if (busy) return;
    setState("checking");
    try {
      const { response, body } = await fetchJsonWithTimeout(`/api/admin/notifications?notificationId=${encodeURIComponent(notificationId)}`, { method: "GET", cache: "no-store" }, 10_000, authorizedFetch);
      const receipt = response.ok ? notificationReceipt(body, notificationId) : null;
      if (!receipt) throw new Error("Unconfirmed status");
      setMessage(notificationStatusMessage(receipt.status) + (receipt.status === "FAILED" ? " This read does not confirm whether the earlier retry has finished; check again before another send." : ""));
      // A negative read is not proof that an earlier uncertain write cannot commit.
      setState(receipt.status === "SENT" ? "finished" : "unconfirmed");
      router.refresh();
    } catch {
      setState("unconfirmed");
      setMessage("Current status is unavailable. No new send was attempted; check again later.");
    }
  }

  return <div className="notification-retry">
    {state === "ready" || state === "sending"
      ? <button type="button" className="button-secondary text-xs" disabled={busy} onClick={retry}>{state === "sending" ? "Requesting retry…" : "Retry email"}</button>
      : state !== "finished" && <button type="button" className="button-secondary text-xs" disabled={busy} onClick={checkStatus}>{state === "checking" ? "Checking…" : "Check email status"}</button>}
    <p role="status" aria-live="polite">{message}</p>
  </div>;
}
