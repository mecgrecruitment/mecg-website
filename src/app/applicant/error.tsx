"use client";

import { useEffect } from "react";

export default function ApplicantError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("applicant portal failed", error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-mecg-paper-workspace px-6 py-10 text-mecg-navy sm:px-10">
      <section className="surface-card mx-auto max-w-2xl bg-white p-8" role="alert">
        <h1 className="text-2xl font-semibold">We could not load your applicant portal.</h1>
        <p className="mt-3 leading-6 text-mecg-navy/65">Try again in a moment. If this keeps happening, email mecg-board@umich.edu.</p>
        <button type="button" onClick={reset} className="button-primary mt-6">Try again</button>
      </section>
    </main>
  );
}
