"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";

const UNKNOWN_ACCOUNT_OUTCOME = "Account setup could not be confirmed. The account or membership may already exist. Keep these details, check Clerk and People for this cycle, then review account recovery before retrying. Do not assume setup failed.";

export function useAccountProvisioning(cycleId: string) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsRecovery, setNeedsRecovery] = useState(false);

  async function act(payload: Record<string, unknown>, form: HTMLFormElement) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(""); setSuccess(""); setNeedsRecovery(false);
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/admin/rush", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, cycleId }) }, 15_000, authorizedFetch);
      if (!response.ok) {
        const uncertain = response.status >= 500 || response.status === 408;
        setNeedsRecovery(uncertain);
        setError(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : uncertain ? UNKNOWN_ACCOUNT_OUTCOME : "Account setup was refused. Check the details and your owner access.");
        return;
      }
      if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string" || !body.id.trim()) {
        setNeedsRecovery(true); setError(UNKNOWN_ACCOUNT_OUTCOME); return;
      }
      form.reset(); setSuccess("Account access confirmed. Refreshing People for this cycle."); router.refresh();
    } catch {
      setNeedsRecovery(true); setError(UNKNOWN_ACCOUNT_OUTCOME);
    } finally { busy.current = false; setPending(false); }
  }
  return { act, pending, error, success, needsRecovery };
}

export function AccountProvisioningRecovery({ cycleId }: { cycleId: string }) {
  const query = `?cycleId=${encodeURIComponent(cycleId)}`;
  return <div className="flex flex-wrap gap-3 text-sm lg:col-span-2">
    <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer" className="button-secondary">Check Clerk account <span className="sr-only">in a new tab</span></a>
    <Link href={`/admin/people${query}`} target="_blank" rel="noreferrer" className="button-secondary">Check cycle access <span className="sr-only">in a new tab</span></Link>
    <Link href={`/admin/provisioning${query}`} target="_blank" rel="noreferrer" className="button-secondary">Open account recovery <span className="sr-only">in a new tab</span></Link>
    <p className="w-full leading-6 text-mecg-navy/70">These links preserve this form. Check the existing account and membership before retrying; a successful request may have no recovery incident.</p>
  </div>;
}
