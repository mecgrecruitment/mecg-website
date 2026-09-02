"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const RECOVERY_DELAY_MS = 12_000;

export default function ClerkLoadingFallback() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), RECOVERY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!timedOut) {
    return <p role="status" className="py-8 text-center text-sm text-mecg-navy/60">Loading secure sign-in…</p>;
  }

  return (
    <div role="alert" className="rounded-xl bg-mecg-blue/[0.08] p-5 text-center text-mecg-navy shadow-[inset_0_0_0_1px_rgba(63,99,175,0.16)]">
      <h2 className="text-lg font-semibold">Sign-in is taking longer than expected.</h2>
      <p className="mt-2 text-sm leading-6 text-mecg-navy/65">
        Check your connection and try loading the secure sign-in form again. No credentials have been submitted.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => window.location.reload()} className="button-primary">Try again</button>
        <Link href="/home" className="button-secondary">Return to the site</Link>
      </div>
      <p className="mt-4 text-xs leading-5 text-mecg-navy/60">
        Still blocked? Email <a href="mailto:mecg-board@umich.edu" className="font-semibold underline underline-offset-2">mecg-board@umich.edu</a>.
      </p>
    </div>
  );
}
