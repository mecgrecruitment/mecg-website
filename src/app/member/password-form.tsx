"use client";

import { useState } from "react";

export default function PasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error ?? "Could not change password");
    else { form.reset(); setMessage("Password changed. Other sessions are now signed out."); }
  }
  return (
    <details className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
      <summary className="cursor-pointer font-semibold">Account security</summary>
      <form onSubmit={submit} className="mt-4 flex max-w-md flex-col gap-3">
        <label className="sr-only" htmlFor="password-current">Current password</label>
        <input id="password-current" name="currentPassword" type="password" autoComplete="current-password" required placeholder="Current password" className="min-h-11 rounded-xl bg-mecg-navy/[0.035] px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]" />
        <label className="sr-only" htmlFor="password-new">New password, at least 8 characters</label>
        <input id="password-new" name="newPassword" type="password" autoComplete="new-password" minLength={8} required placeholder="New password, at least 8 characters" className="min-h-11 rounded-xl bg-mecg-navy/[0.035] px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]" />
        <button className="button-primary">Change password</button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
      </form>
    </details>
  );
}
