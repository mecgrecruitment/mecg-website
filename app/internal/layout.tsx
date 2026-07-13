import React from "react";
import Link from "next/link";
import { requireMember, ROLE_LABELS } from "@/lib/auth";
import { logout } from "../auth/actions";

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await requireMember();

  const nav = [
    { href: "/internal/applicants", label: "Applicants" },
    { href: "/internal/scoring", label: "Scoring" },
    { href: "/internal/calendar", label: "Calendar" },
    { href: "/internal/hash", label: "Hash Decisions" },
    { href: "/internal/members", label: "Members" },
  ];

  return (
    <main className="portal-shell">
      <a href="#portal-content" className="skip-link">Skip to portal content</a>
      <header className="portal-header px-5 py-4 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <Link href="/internal">
            <p className="annotation text-white/38">MECG Internal</p>
            <h1 className="font-display mt-1 text-3xl font-bold uppercase tracking-[-0.06em] md:text-4xl">
              Recruitment Portal
            </h1>
            <p className="mt-1 text-xs text-white/40">
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
          </nav>
        </div>
      </header>

      <section id="portal-content" tabIndex={-1} className="px-5 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-[1600px]">{children}</div>
      </section>
    </main>
  );
}
