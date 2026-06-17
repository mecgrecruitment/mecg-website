import React from "react";
import Link from "next/link";

export default function ApplicantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--navy-950)] text-white">
      <header className="border-b border-white/10 bg-[rgba(8,18,37,0.92)] px-5 py-4 backdrop-blur-xl md:px-8">
        <div className="mx-auto max-w-[1200px]">
          <Link href="/apply">
            <p className="annotation text-white/38">MECG</p>
            <h1 className="font-display mt-1 text-2xl font-bold uppercase tracking-[-0.05em] md:text-3xl">
              Applicant Portal
            </h1>
          </Link>
        </div>
      </header>

      <section className="px-5 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </section>
    </main>
  );
}
