"use client";

import { useEffect } from "react";
import LogoutButton from "@/components/logout-button";

export default function ApplyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("apply page failed", error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-paper px-6 py-10 text-mecg-navy sm:px-10">
      <section className="surface-card mx-auto max-w-2xl bg-white p-8" role="alert">
        <h1 className="text-2xl font-semibold">We could not load the application.</h1>
        <p className="mt-3 leading-6 text-muted">Try again in a moment. If this keeps happening, email mecg-board@umich.edu.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={reset} className="button-primary">Try again</button>
          <LogoutButton className="button-secondary" />
        </div>
      </section>
    </main>
  );
}
