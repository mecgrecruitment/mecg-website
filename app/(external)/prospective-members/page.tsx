import React from "react";
import Image from "next/image";
import type { Metadata } from "next";
import { faqs, recruitmentCycle, recruitmentEvents } from "@/lib/site-content";
import { Timeline } from "../components/Timeline";
import { PageHero } from "../components/PageHero";

const title = "Prospective Members";
const description =
  "MECG recruits students of all majors. See the recruitment timeline — meet us, apply, interview — plus event dates, FAQs, and what life in the club actually looks like.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/prospective-members" },
  openGraph: { title, description },
};

const memberSignals = [
  {
    index: "01",
    title: "Any major",
    body: "MECG is interdisciplinary by design. Technical, creative, and analytical perspectives all strengthen the work.",
  },
  {
    index: "02",
    title: "No consulting prerequisite",
    body: "Recruitment looks for curiosity, collaboration, and follow-through—not a pre-existing consulting vocabulary.",
  },
  {
    index: "03",
    title: "Learn through practice",
    body: "Members build skills through education, mentorship, and semester-long client engagements.",
  },
  {
    index: "04",
    title: "Join a community",
    body: "Project work is one part of MECG. Coffee chats, social events, and shared campus life matter too.",
  },
];

export default function ProspectiveMembersPage() {
  return (
    <main>
      <PageHero
        eyebrow="Sheet 05 — Prospective Members"
        title={<>Bring your perspective.<br /> <span className="text-ghost">Build new range.</span></>}
        description="MECG is open to students of every major who want to explore consulting, contribute to client work, and join an ambitious, supportive community."
        tone="orange"
      >
        <div className="flex flex-wrap gap-3">
          <a href="/apply" data-magnetic className="button-primary focus-ring">Login / Apply</a>
          <a href="/apply/checkin" className="button-secondary focus-ring">Event check-in</a>
        </div>
      </PageHero>

      <section className="section">
        <div className="container">
          <p className="annotation annotation-accent">Fig. 05.1 — Is MECG for me?</p>
          <h2 className="display mt-5 max-w-5xl text-5xl uppercase text-white md:text-7xl">
            Start with curiosity.
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-4">
            {memberSignals.map((item) => (
              <article key={item.index} className="bg-[var(--navy-900)] p-7 lg:min-h-72">
                <p className="font-mono text-sm font-bold text-[var(--orange)]">{item.index}</p>
                <h3 className="font-display mt-10 text-3xl font-bold uppercase leading-[0.95] tracking-[-0.05em] text-white">
                  {item.title}
                </h3>
                <p className="mt-5 text-sm leading-7 text-white/56">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="annotation annotation-accent" data-reveal>
            Fig. 05.2 — Where our alumni work
          </p>
          <h2 className="display mt-5 max-w-4xl text-5xl uppercase text-white md:text-7xl">
            The work carries beyond MECG.
          </h2>
          <p className="mt-6 max-w-2xl text-white/58">
            Members have gone on to internships and full-time roles at firms across consulting,
            tech, finance, and engineering.
          </p>
          <div className="mt-10 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white p-6 md:p-10">
            <Image
              src="/images/placement/alumni-employers.jpg"
              alt="Logos of employers where MECG alumni have interned or worked full-time, including Microsoft, Goldman Sachs, Meta, Tesla, Citadel, Deloitte, Capital One, IBM, JPMorganChase, BlackRock, BCG, Disney, United Airlines, Jane Street, EY, and others"
              width={1800}
              height={1013}
              sizes="(min-width: 1024px) 1400px, 100vw"
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section className="sheet px-5 py-20 md:px-8 md:py-28">
        <div className="container">
          <div className="mb-16 grid gap-6 rounded-[1.5rem] border border-[var(--paper-rule)] p-6 md:grid-cols-[0.35fr_1fr] md:p-8">
            <div>
              <p className="annotation !text-[var(--orange-dark)]">Current status</p>
              <p className="mt-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--navy-950)]">
                {recruitmentCycle.status}
              </p>
            </div>
            <div>
              <h2 className="font-display text-3xl font-bold uppercase tracking-[-0.05em] text-[var(--navy-950)]">
                {recruitmentCycle.title}
              </h2>
              <p className="mt-4 max-w-3xl leading-relaxed text-[var(--on-paper-muted)]">
                {recruitmentCycle.body}
              </p>
            </div>
          </div>
          <p className="annotation !text-[rgba(5,9,20,0.45)]" data-reveal>
            Fig. 05.3 — {recruitmentCycle.archiveLabel}
          </p>
          <h2 className="display mt-5 max-w-4xl text-5xl uppercase text-[var(--navy-950)] md:text-7xl" data-split>
            What to expect.
          </h2>

          <div className="mt-12 max-w-3xl">
            <Timeline
              variant="scroll"
              items={recruitmentEvents.map((event) => ({
                id: event.code,
                index: event.code,
                title: event.title,
                meta: `${event.type} · ${event.date} · ${event.time}`,
                body: `${event.location}. ${event.body}`,
              }))}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="annotation annotation-accent" data-reveal>
            Fig. 05.4 — Questions before applying
          </p>
          <h2 className="display mt-5 max-w-4xl text-5xl uppercase text-white md:text-7xl">
            Know what to expect.
          </h2>
          <div className="mt-10 grid gap-4" data-reveal-group>
            {faqs.map((faq) => (
              <details key={faq.question} className="group panel card-hover rounded-[1.35rem]" data-reveal>
                <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-6 p-6">
                  <h3 className="font-display text-2xl font-bold uppercase tracking-[-0.04em] text-white md:text-3xl">
                    {faq.question}
                  </h3>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 font-mono text-lg font-bold text-[var(--orange)] transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="border-t border-white/10 px-6 pb-6 pt-5 leading-relaxed text-white/56">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
