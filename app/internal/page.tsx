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
  // Same frequency order as the header nav so operators land on hot paths first.
  const cards = [
    {
      index: "01",
      title: "Applicants",
      body: "Review submissions, current stage, and open-rush attendance.",
      href: "/internal/applicants",
      show: canRecruit,
    },
    {
      index: "02",
      title: "Scoring",
      body: "Open assigned speed dating, group case, or final-round scorecards.",
      href: "/internal/scoring",
      show: canRecruit,
    },
    {
      index: "03",
      title: "Hash",
      body: "Anonymous Advance / Cut / Discuss votes, then board records official decisions.",
      href: "/internal/hash",
      show: canRecruit,
    },
    {
      index: "04",
      title: "Members",
      body: isBoard
        ? "Approve access, grant roles, and assign scorers."
        : "View the current internal member roster.",
      href: "/internal/members",
      show: true,
    },
    {
      index: "05",
      title: "Events & check-ins",
      body: "Event schedule, attendance codes, and the live check-in feed.",
      href: "/internal/events",
      show: canRecruit,
    },
    {
      index: "06",
      title: "Audit log",
      body: "Append-only history of recruitment and access changes.",
      href: "/internal/audit",
      show: isBoard,
    },
    {
      index: "07",
      title: "Decision emails",
      body: "Build mailto drafts from accepted / waitlisted / rejected groups. Nothing is sent here.",
      href: "/internal/emails",
      show: isBoard,
    },
  ].filter((card) => card.show);

  // Re-number after role filtering so general members don't see "04" as their only card.
  const visibleCards = cards.map((card, index) => ({
    ...card,
    index: String(index + 1).padStart(2, "0"),
  }));

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
        {visibleCards.map((card) => (
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
