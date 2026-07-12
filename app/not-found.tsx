import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "This sheet is not in the drawing set.",
};

export default function NotFound() {
  return (
    <main className="grain">
      <section className="grid-bg relative flex min-h-svh flex-col justify-center overflow-hidden px-5 py-32 md:px-8">
        <div className="orb right-[-12rem] top-[-12rem] h-[30rem] w-[30rem] bg-[var(--blue)]" />
        <div className="orb bottom-[-14rem] left-[-12rem] h-[26rem] w-[26rem] bg-[var(--orange-dark)]" />

        <div className="container relative">
          <p className="annotation annotation-accent">Error 404 — Sheet missing</p>
          <h1 className="display-xl mt-6 max-w-4xl text-white">
            This page <span className="text-ghost">isn&apos;t drawn.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-white/62">
            The link is broken or the page has moved. Everything else is still
            where you left it.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/"
              className="focus-ring rounded-full bg-[var(--orange)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-white hover:text-[var(--navy-950)]"
            >
              Back home
            </Link>
            <Link
              href="/contact"
              className="focus-ring rounded-full border border-white/16 px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-white/40 hover:text-white"
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
