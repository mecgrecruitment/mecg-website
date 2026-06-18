import React from "react";
import Link from "next/link";
import { requireInternalSession } from "@/lib/internal-portal/session";
import { memberLogout } from "../member-login/actions";

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireInternalSession();

  const nav = [
    { href: "/internal/applicants", label: "Applicants" },
    { href: "/internal/scoring", label: "Scoring" },
    { href: "/internal/calendar", label: "Calendar" },
    { href: "/internal/hash", label: "Hash Decisions" },
    { href: "/internal/members", label: "Members" },
  ];

  return (
    <main className="min-h-screen bg-[var(--navy-950)] text-white">
      <header className="border-b border-white/10 bg-[rgba(8,18,37,0.92)] px-5 py-4 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <Link href="/internal">
            <p className="annotation text-white/38">MECG Internal</p>
            <h1 className="font-display mt-1 text-3xl font-bold uppercase tracking-[-0.06em] md:text-4xl">
              Recruitment Portal
            </h1>
            <p className="mt-1 text-xs text-white/40">
              {session.fullName} · {session.role}
            </p>
          </Link>

          <nav className="flex gap-2 overflow-x-auto pb-1 md:justify-end md:pb-0">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-white/58 transition hover:border-[var(--orange)] hover:bg-[var(--orange)] hover:text-white"
              >
                {item.label}
              </Link>
            ))}

            <form action={memberLogout}>
              <button className="shrink-0 rounded-full border border-white/10 bg-whte/[0.035] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-white/58 transition hover:border-red-300/40 hover:bg-red-400/20 hover:text-white">
                Logout
              </button>
            </form>
          </nav>
        </div>
      </header>

      <section className="px-5 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-[1600px]">{children}</div>
      </section>
    </main>
  );
}
