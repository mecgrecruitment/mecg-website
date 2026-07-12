"use client";

import React, { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grain">
      <section className="grid-bg relative flex min-h-svh flex-col justify-center overflow-hidden px-5 py-32 md:px-8">
        <div className="orb left-[-12rem] top-[-10rem] h-[30rem] w-[30rem] bg-[var(--orange-dark)]" />

        <div className="container relative">
          <p className="annotation annotation-accent">Error — Something jammed</p>
          <h1 className="display-xl mt-6 max-w-4xl text-white">
            The gears <span className="text-ghost">slipped.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-white/62">
            Something went wrong on our side. Try again, or head back home and
            take another route.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="focus-ring rounded-full bg-[var(--orange)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-white hover:text-[var(--navy-950)]"
            >
              Try again
            </button>
            <Link
              href="/"
              className="focus-ring rounded-full border border-white/16 px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-white/40 hover:text-white"
            >
              Back home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
