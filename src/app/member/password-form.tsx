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
  return <details className="rounded-xl border p-5"><summary className="cursor-pointer font-semibold">Account security</summary><form onSubmit={submit} className="mt-4 flex max-w-md flex-col gap-3"><input name="currentPassword" type="password" autoComplete="current-password" required placeholder="Current password" className="rounded border px-3 py-2" /><input name="newPassword" type="password" autoComplete="new-password" minLength={12} required placeholder="New password, at least 12 characters" className="rounded border px-3 py-2" /><button className="rounded bg-slate-950 px-4 py-2 text-white">Change password</button>{error && <p className="text-sm text-red-700">{error}</p>}{message && <p className="text-sm text-green-700">{message}</p>}</form></details>;
}
