"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ApplyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch("/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contact, consent }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "Could not submit application");
      setPending(false);
      return;
    }
    if (response.status === 202) {
      setAccepted(true);
      setPending(false);
      return;
    }
    router.push(`/applicant/${body.portalToken}`);
  }

  return (
    <main className="grid min-h-dvh bg-mecg-navy text-white lg:grid-cols-[0.85fr_1.15fr]">
      <aside className="relative hidden overflow-hidden border-r border-white/10 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="project-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
        <Link href="/home" className="relative w-fit rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mecg-orange">
          <Image src="/logos/mecg-white.svg" alt="MECG home" width={150} height={40} priority className="h-10 w-auto" style={{ width: "auto" }} />
        </Link>
        <div className="relative max-w-lg">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mecg-orange">Rush / 2026</p>
          <h1 className="mt-6 text-balance text-6xl font-semibold leading-[0.98] tracking-[-0.055em]">Your next project starts here.</h1>
          <p className="mt-6 text-pretty text-lg leading-8 text-white/60">MECG is open to University of Michigan students from every major. Submit once, then keep your private status link.</p>
        </div>
        <p className="relative font-mono text-xs uppercase tracking-[0.15em] text-white/35">Michigan Engineering Consulting Group</p>
      </aside>

      <section className="flex min-h-dvh items-center bg-white px-6 py-8 text-mecg-navy sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link href="/home" className="rounded-xl bg-mecg-navy px-3 py-2"><Image src="/logos/mecg-white.svg" alt="MECG home" width={107} height={32} priority /></Link>
            <Link href="/home" className="text-sm text-mecg-navy/55">Back to site</Link>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mecg-orange">Application intake</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Apply to MECG.</h2>
          <p className="mt-5 max-w-lg text-pretty leading-7 text-mecg-navy/60">Enter your contact information for the current rush cycle. After you submit, we will create a private link for your application status.</p>

          {accepted ? (
            <div className="mt-7 rounded-2xl bg-mecg-blue/15 p-5 text-sm leading-6">
              An application for this contact already exists. Use the private link issued with the first submission, or email <a className="font-semibold underline" href="mailto:mecg-board@umich.edu">mecg-board@umich.edu</a> for help.
            </div>
          ) : (
            <form onSubmit={submit} className="mt-7 space-y-5">
              <label className="block text-sm font-medium">Full name
                <input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" className="mt-2 min-h-12 w-full rounded-xl bg-mecg-navy/[0.035] px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#fe904d]" />
              </label>
              <label className="block text-sm font-medium">Email or phone
                <input value={contact} onChange={(event) => setContact(event.target.value)} required autoComplete="email" className="mt-2 min-h-12 w-full rounded-xl bg-mecg-navy/[0.035] px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#fe904d]" />
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-mecg-navy/65">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required className="mt-1 h-4 w-4 accent-mecg-orange" />
                <span>I consent to MECG using this information to administer the current rush cycle.</span>
              </label>
              {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
              <button disabled={pending} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
                {pending ? "Submitting..." : "Submit application"}
              </button>
            </form>
          )}
          <p className="mt-6 text-center text-xs leading-5 text-mecg-navy/40">Questions? Email <a href="mailto:mecg-board@umich.edu" className="underline">mecg-board@umich.edu</a>.</p>
        </div>
      </section>
    </main>
  );
}
