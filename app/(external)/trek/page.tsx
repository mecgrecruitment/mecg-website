import React from "react";
import type { Metadata } from "next";
import { contact } from "@/lib/site-content";
import { PageHero } from "../components/PageHero";

const title = "Trek";
const description =
  "MECG's professional trek connects students with companies, alumni, and the environments where consulting and adjacent careers happen.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/trek" },
  openGraph: { title, description },
};

const trekOutcomes = [
  {
    index: "01",
    title: "See the work up close",
    body: "Move beyond job descriptions by hearing how teams frame problems, collaborate, and build careers.",
  },
  {
    index: "02",
    title: "Ask better questions",
    body: "Small-group conversations give members room to explore roles, industries, and day-to-day realities.",
  },
  {
    index: "03",
    title: "Bring insight home",
    body: "Members return with clearer career context, stronger connections, and ideas to share with the wider club.",
  },
];

const visitShape = [
  ["Company context", "An introduction to the organization, its work, and the paths people take into it."],
  ["Working conversation", "A candid discussion with professionals or alumni about projects, teams, and careers."],
  ["Member reflection", "Time to compare takeaways and connect what members saw to their own goals."],
];

export default function TrekPage() {
  return (
    <main>
      <PageHero
        eyebrow="Sheet 08 — Professional Trek"
        title={<>Go where the work happens.<br /> <span className="text-ghost">Return with perspective.</span></>}
        description="MECG's professional trek gives members direct exposure to companies, alumni, and the environments where consulting and adjacent careers take shape."
        tone="mixed"
      >
        <a href={contact.instagram} target="_blank" rel="noreferrer" className="button-primary focus-ring">
          Follow trek updates
        </a>
      </PageHero>

      <section className="section">
        <div className="container">
          <p className="annotation annotation-accent">Fig. 08.1 — Purpose</p>
          <h2 className="display mt-5 max-w-5xl text-5xl uppercase text-white md:text-7xl">
            Career exploration, in context.
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/58">
            A trek is more than a sequence of office visits. It is a structured way to
            understand how organizations operate, hear honest career stories, and make
            professional possibilities feel tangible.
          </p>

          <div className="mt-12 grid gap-px overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10 md:grid-cols-3">
            {trekOutcomes.map((item) => (
              <article key={item.index} className="bg-[var(--navy-900)] p-7 md:min-h-72 md:p-9">
                <p className="font-mono text-sm font-bold text-[var(--orange)]">{item.index}</p>
                <h3 className="font-display mt-10 text-3xl font-bold uppercase tracking-[-0.05em] text-white">{item.title}</h3>
                <p className="mt-5 leading-7 text-white/56">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sheet px-5 py-20 md:px-8 md:py-28">
        <div className="container grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="annotation !text-[var(--orange-dark)]">Fig. 08.2 — Visit shape</p>
            <h2 className="display mt-5 text-5xl uppercase text-[var(--navy-950)] md:text-7xl">A useful day, not a tour.</h2>
          </div>
          <ol className="grid gap-4">
            {visitShape.map(([title, body], index) => (
              <li key={title} className="grid gap-4 rounded-[1.25rem] border border-[var(--paper-rule)] p-6 md:grid-cols-[3rem_1fr] md:p-8">
                <span className="font-mono text-sm font-bold text-[var(--orange-dark)]">0{index + 1}</span>
                <div>
                  <h3 className="font-display text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--navy-950)]">{title}</h3>
                  <p className="mt-3 leading-7 text-[var(--on-paper-muted)]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section pt-16">
        <div className="container grid gap-8 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-7 md:grid-cols-[1fr_auto] md:items-end md:p-10">
          <div>
            <p className="annotation annotation-accent">Next route</p>
            <h2 className="font-display mt-5 text-4xl font-bold uppercase tracking-[-0.06em] text-white md:text-6xl">Details publish when confirmed.</h2>
            <p className="mt-5 max-w-2xl leading-7 text-white/56">Dates, destinations, and participating organizations vary by trek. Follow MECG for confirmed updates or contact the board with a partnership question.</p>
          </div>
          <a href="/contact" className="button-secondary focus-ring">Ask about trek</a>
        </div>
      </section>
    </main>
  );
}
