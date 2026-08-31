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
    <details className="group rounded-2xl bg-mecg-navy/[0.025] shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 marker:content-none">
        <span>
          <span className="block text-sm font-semibold text-mecg-navy">Account security</span>
          <span className="mt-0.5 block text-xs text-mecg-navy/45">Change your password and sign out other sessions.</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-mecg-navy/45 transition-transform group-open:rotate-180" aria-hidden="true">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </summary>
      <form onSubmit={submit} className="flex max-w-md flex-col gap-3 border-t border-mecg-navy/10 p-5">
        <label className="sr-only" htmlFor="password-current">Current password</label>
        <input id="password-current" name="currentPassword" type="password" autoComplete="current-password" required placeholder="Current password" className="field-control" />
        <label className="sr-only" htmlFor="password-new">New password, at least 8 characters</label>
        <input id="password-new" name="newPassword" type="password" autoComplete="new-password" minLength={8} required placeholder="New password, at least 8 characters" className="field-control" />
        <button className="button-primary">Change password</button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
      </form>
    </details>
  );
}
