import React from "react";
import Link from "next/link";
import { requireMember } from "@/lib/auth";

export default async function InternalDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const member = await requireMember();
  const params = await searchParams;
  const canRecruit = member.role === "recruitment_committee" || member.role === "board";
  const isBoard = member.role === "board";
  const cards = [
    {
      index: "01",
      title: "Scoring",
      body: "Open your assigned speed dating, group case, or final-round scoring work.",
      href: "/internal/scoring",
      show: true,
    },
    {
      index: "02",
      title: "Applicants",
      body: "Review submissions, profile information, current stage, and open-rush attendance.",
      href: "/internal/applicants",
      show: canRecruit,
    },
    {
      index: "03",
      title: "Calendar & check-ins",
      body: "See recruitment timing, event codes, and the live attendance feed.",
      href: "/internal/calendar",
      show: canRecruit,
    },
    {
      index: "04",
      title: "Hash decisions",
      body: "Vote on candidates and centralize final board decisions.",
      href: "/internal/hash",
      show: canRecruit,
    },
    {
      index: "05",
      title: "Members",
      body: isBoard
        ? "Approve access requests, review the roster, and assign scorers."
        : "View the current internal member roster.",
      href: "/internal/members",
      show: true,
    },
    {
      index: "06",
      title: "Decision emails",
      body: "Review recipient groups and open ready-to-send decision drafts.",
      href: "/internal/emails",
      show: isBoard,
    },
    {
      index: "07",
      title: "Audit log",
      body: "Review the append-only history of recruitment and access changes.",
      href: "/internal/audit",
      show: isBoard,
    },
  ].filter((card) => card.show);

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
          Your workspace only shows the recruitment tools available to your current role.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="panel card-hover rounded-[1.5rem] p-6">
            <p className="font-mono text-sm font-bold text-[var(--orange)]">{card.index}</p>
            <h3 className="font-display mt-8 text-2xl font-bold uppercase tracking-[-0.04em]">
              {card.title}
            </h3>
            <p className="mt-4 text-sm leading-6 text-white/55">{card.body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
