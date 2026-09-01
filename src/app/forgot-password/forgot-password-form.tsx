"use client";

import { useState } from "react";
import PortalShell from "@/components/portal-shell";
import FormField from "@/components/form-field";
import OperationNotice from "@/components/operation-notice";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.code === "RATE_LIMITED" ? "Wait a minute before requesting another reset email." : "Enter a valid email address.");
        return;
      }
      setMessage("If that account exists, Supabase sent a password-reset email.");
    } catch {
      setError("Password recovery is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell eyebrow="Account recovery" title="Reset your password." description="Use the email attached to your MECG account." centered>
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <OperationNotice kind="info">{message}</OperationNotice>
        <OperationNotice kind="error">{error}</OperationNotice>
        <button type="submit" disabled={busy} className="button-primary w-full disabled:opacity-50">{busy ? "Sending..." : "Send reset email"}</button>
      </form>
    </PortalShell>
  );
}
