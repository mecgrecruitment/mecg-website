import React from "react";
import Link from "next/link";
import { requireMember } from "@/lib/auth";

const cards = [
  {
    title: "Applicants",
    body: "View applicant submissions, profile information, and recruitment status.",
    href: "/internal/applicants",
  },
  {
    title: "Scoring",
    body: "Score speed dating, group case, and final round interviews in one place.",
    href: "/internal/scoring",
  },
  {
    title: "Calendar",
    body: "View recruitment events and timing.",
    href: "/internal/calendar",
  },
  {
    title: "Hash Decisions",
    body: "Centralize final candidate discussion and decisions.",
    href: "/internal/hash",
  },
  {
    title: "Members",
    body: "View members, approve access requests, and assign scorers.",
    href: "/internal/members",
  },
];

export default async function InternalDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const member = await requireMember();
  const params = await searchParams;

  return (
    <div className="grid gap-8">
      {params?.error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {params.error}
        </p>
      ) : null}

      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Internal Portal</p>
        <h2 className="font-display mt-5 text-5xl font-bold uppercase leading-[0.9] tracking-[-0.07em] md:text-7xl">
          Welcome, {(member.full_name ?? "there").split(" ")[0]}.
        </h2>
        <p className="mt-6 max-w-2xl text-white/58">
          This portal is for recruitment operations: applicants, scoring, calendar, hash decisions, and members.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="panel card-hover rounded-[1.5rem] p-6">
            <h3 className="font-display text-2xl font-bold uppercase tracking-[-0.04em]">
              {card.title}
            </h3>
            <p className="mt-4 text-sm leading-6 text-white/55">{card.body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
