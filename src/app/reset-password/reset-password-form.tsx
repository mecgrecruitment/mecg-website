"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PortalShell from "@/components/portal-shell";
import FormField from "@/components/form-field";

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
        setError(body?.code === "RECOVERY_SESSION_REQUIRED" ? "Open the password-reset link from your email again." : "The password could not be updated.");
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
    <PortalShell eyebrow="Account recovery" title="Choose a new password." description="Use at least 8 characters.">
      <form onSubmit={submit} className="space-y-4">
        <FormField label="New password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button type="submit" disabled={busy} className="button-primary w-full disabled:opacity-50">{busy ? "Updating..." : "Update password"}</button>
      </form>
    </PortalShell>
  );
}
