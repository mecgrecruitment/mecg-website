import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Applicant Portal",
  robots: { index: false, follow: false },
};

export default function ApplicantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="portal-shell">
      <a href="#applicant-content" className="skip-link">Skip to application</a>
      <header className="portal-header px-5 py-4 md:px-8">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/apply" className="focus-ring rounded-sm">
            <p className="annotation text-white/38">MECG · Application system</p>
            <h1 className="font-display mt-1 text-2xl font-bold uppercase tracking-[-0.05em] md:text-3xl">Applicant Portal</h1>
          </Link>
          <nav className="flex gap-2 overflow-x-auto pb-1 sm:justify-end sm:pb-0" aria-label="Applicant portal">
            <Link href="/apply/dashboard" className="portal-nav-link focus-ring">Dashboard</Link>
            <Link href="/prospective-members" className="portal-nav-link focus-ring">Recruitment info</Link>
            <Link href="/" className="portal-nav-link focus-ring">Website ↗</Link>
          </nav>
        </div>
      </header>

      <section id="applicant-content" tabIndex={-1} className="px-5 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </section>
    </main>
  );
}
