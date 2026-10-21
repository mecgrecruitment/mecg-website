"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import OperationNotice from "@/components/operation-notice";

export default function ResolveButton({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "resolved">("idle");
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function resolve() {
    if (state !== "idle" || inFlight.current) return;
    if (!window.confirm("Mark this incident resolved? Confirm you have checked the Clerk account and MECG membership and completed any needed remediation. This records resolution only; it does not repair or delete an account, grant access, or send an email.")) return;
    inFlight.current = true;
    setState("saving");
    setError("");
    try {
      const { response, body: payload } = await fetchJsonWithTimeout(`/api/admin/provisioning/${encodeURIComponent(incidentId)}/resolve`, { method: "POST" }, 15_000, authorizedFetch);
      const recorded = response.ok && payload !== null && typeof payload === "object" && "resolved" in payload && payload.resolved === true;
      if (!recorded) {
        setError("Resolution could not be confirmed. Reload the queue to check its current status and your owner access before retrying.");
        setState("idle");
        return;
      }
      setState("resolved");
      router.refresh();
    } catch {
      setError("Resolution could not be confirmed. Reload the queue to check its current status before retrying.");
      setState("idle");
    } finally { inFlight.current = false; }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button type="button" className="button-secondary text-sm" disabled={state !== "idle"} onClick={resolve}>
        {state === "saving" ? "Recording resolution…" : state === "resolved" ? "Resolution recorded" : "Mark resolved"}
      </button>
      {error && <OperationNotice kind="error">{error}</OperationNotice>}
      {state === "resolved" && <p role="status" className="text-sm text-muted">Resolution recorded. Refreshing the queue.</p>}
    </div>
  );
}
