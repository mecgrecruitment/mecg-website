"use client";

import { useEffect } from "react";

export default function ApplicantError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("applicant portal failed", error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-[#f5f4ef] px-6 py-10 text-mecg-navy sm:px-10">
      <section className="mx-auto max-w-2xl rounded-[28px] bg-white p-8 shadow-[0_24px_80px_rgba(7,13,31,0.09)]" role="alert">
        <h1 className="text-2xl font-semibold">We could not load your applicant portal.</h1>
        <p className="mt-3 leading-6 text-mecg-navy/65">Try again in a moment. If this keeps happening, email mecg-board@umich.edu.</p>
        <button type="button" onClick={retry} className="button-primary mt-6">Try again</button>
      </section>
    </main>
  );
}
