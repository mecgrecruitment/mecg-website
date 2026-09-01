"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PortalShell from "@/components/portal-shell";
import FormField from "@/components/form-field";
import OperationNotice from "@/components/operation-notice";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const messages: Record<string, string> = {
          RECOVERY_SESSION_REQUIRED: "Open the password-reset link from your email again.",
          RATE_LIMITED: "Too many attempts. Wait a few minutes and try again.",
          INVALID_PASSWORD: "Use a password between 8 and 1024 characters.",
        };
        setError(messages[body?.code] ?? "The password could not be updated.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Password reset is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell eyebrow="Account recovery" title="Choose a new password." description="Use at least 8 characters." centered>
      <form onSubmit={submit} className="space-y-4">
        <FormField label="New password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <OperationNotice kind="error">{error}</OperationNotice>
        <button type="submit" disabled={busy} className="button-primary w-full disabled:opacity-50">{busy ? "Updating…" : "Update password"}</button>
      </form>
    </PortalShell>
  );
}
