import React from "react";
import Link from "next/link";
import { requireCommittee } from "@/lib/auth";

export default async function ScoringHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const member = await requireCommittee();
  const params = await searchParams;

  const cards = [
    {
      title: "Speed Dating",
      body: "Score the candidates assigned to you during speed dating and save responses.",
      href: "/internal/scoring/speed-dating",
      show: true,
    },
    {
      title: "Group Case",
      body: "See the candidates assigned to you and score them during the group case.",
      href: "/internal/scoring/group-case",
      show: true,
    },
    {
      title: "Final Round",
      body: "Board-only interview scoring. Peer scores stay blind until each board member submits.",
      href: "/internal/scoring/final-round",
      show: member.role === "board",
    },
  ];

  return (
    <div className="grid gap-8">
      {params?.error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {params.error}
        </p>
      ) : null}

      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Scoring</p>
        <h2 className="font-display mt-5 text-5xl font-bold uppercase tracking-[-0.07em] md:text-7xl">
          Select a scoring event.
        </h2>
        <p className="mt-5 max-w-2xl text-white/58">
          Each scorecard shows <span className="text-white/80">Not yet submitted</span> or{" "}
          <span className="text-white/80">Submitted</span>. Peer scores stay blind until you
          submit that candidate. Board records official outcomes in Hash — not here.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards
          .filter((card) => card.show)
          .map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="panel card-hover rounded-[1.5rem] p-6"
            >
              <h3 className="font-display text-3xl font-bold uppercase tracking-[-0.05em]">
                {card.title}
              </h3>
              <p className="mt-4 leading-6 text-white/55">{card.body}</p>
            </Link>
          ))}
      </section>
    </div>
  );
}
