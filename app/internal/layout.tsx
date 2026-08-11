import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireMember, ROLE_LABELS } from "@/lib/auth";
import { logout } from "../auth/actions";

export const metadata: Metadata = {
  title: "Internal Portal",
  robots: { index: false, follow: false },
};

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await requireMember();
  const canRecruit = member.role === "recruitment_committee" || member.role === "board";
  const isBoard = member.role === "board";

  const nav = [
    { href: "/internal", label: "Overview", show: true },
    { href: "/internal/scoring", label: "Scoring", show: true },
    { href: "/internal/applicants", label: "Applicants", show: canRecruit },
    { href: "/internal/calendar", label: "Calendar", show: canRecruit },
    { href: "/internal/events", label: "Check-ins", show: canRecruit },
    { href: "/internal/hash", label: "Hash", show: canRecruit },
    { href: "/internal/members", label: "Members", show: true },
    { href: "/internal/emails", label: "Emails", show: isBoard },
    { href: "/internal/audit", label: "Audit", show: isBoard },
  ].filter((item) => item.show);

  return (
    <main className="portal-shell">
      <a href="#portal-content" className="skip-link">Skip to portal content</a>
      <header className="portal-header px-5 py-4 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <Link href="/internal" className="focus-ring rounded-sm">
            <p className="annotation text-white/38">MECG Internal</p>
            <h1 className="font-display mt-1 text-3xl font-bold uppercase tracking-[-0.06em] md:text-4xl">
              Recruitment Portal
            </h1>
            <p className="mt-2 inline-flex rounded-full border border-[var(--orange)]/30 bg-[var(--orange)]/10 px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--orange-soft)]">
              {member.full_name} · {ROLE_LABELS[member.role]}
            </p>
          </Link>

          <nav className="flex gap-2 overflow-x-auto pb-1 md:justify-end md:pb-0">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="portal-nav-link focus-ring"
              >
                {item.label}
              </Link>
            ))}

            <form action={logout}>
              <button className="portal-nav-link focus-ring cursor-pointer hover:!border-red-300/40 hover:!bg-red-400/15">
                Logout
              </button>
            </form>

            <Link href="/" className="portal-nav-link focus-ring">Website ↗</Link>
          </nav>
        </div>
      </header>

      <section id="portal-content" tabIndex={-1} className="px-5 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-[1600px]">{children}</div>
      </section>
    </main>
  );
}
