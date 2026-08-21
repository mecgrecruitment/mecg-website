"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ApplicationForm({ initialName, email }: { initialName: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, consent }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "The application could not be submitted.");
        return;
      }
      router.replace("/applicant");
      router.refresh();
    } catch {
      setError("The application could not be submitted. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-5">
      <label className="block text-sm font-medium">Full name
        <input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" className="mt-2 min-h-12 w-full rounded-xl bg-mecg-navy/[0.035] px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#fe904d]" />
      </label>
      <label className="block text-sm font-medium">Verified email
        <input value={email} readOnly className="mt-2 min-h-12 w-full rounded-xl bg-mecg-navy/[0.06] px-4 text-mecg-navy/60 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]" />
      </label>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-mecg-navy/65">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required className="mt-1 h-4 w-4 accent-mecg-orange" />
        <span>I consent to MECG using this information to administer the current rush cycle.</span>
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={pending} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Submitting..." : "Submit application"}
      </button>
    </form>
  );
}
