"use client";

import { useEffect } from "react";

export default function ReferError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[55vh] max-w-2xl items-center px-5 py-12">
      <div className="w-full rounded-xl bg-white p-6 inset-ring inset-ring-line sm:p-8">
        <p className="text-sm font-semibold text-mecg-orange-ink">Referrals are temporarily unavailable</p>
        <h1 className="mt-2 text-2xl font-semibold text-mecg-navy">We could not load this page.</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Try loading this page again. If the problem continues, return to the member workspace.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={retry} className="button-primary min-h-11">Try again</button>
          <a href="/member" className="button-secondary min-h-11">Member workspace</a>
        </div>
      </div>
    </main>
  );
}
