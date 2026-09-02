"use client";

import { useEffect } from "react";

export default function ReferError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[55vh] max-w-2xl items-center px-5 py-12">
      <div className="w-full rounded-2xl bg-white p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-8">
        <p className="text-sm font-semibold text-mecg-orange-ink">Referrals are temporarily unavailable</p>
        <h1 className="mt-2 text-2xl font-semibold text-mecg-navy">We could not load this page.</h1>
        <p className="mt-2 text-sm leading-6 text-mecg-navy/65">Try loading this page again. If the problem continues, return to the member workspace.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={retry} className="button-primary min-h-11">Try again</button>
          <a href="/member" className="button-secondary min-h-11">Member workspace</a>
        </div>
      </div>
    </main>
  );
}
