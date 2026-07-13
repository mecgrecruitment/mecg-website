import React from "react";
import type { Metadata } from "next";
import { faqs, recruitmentCycle, recruitmentEvents } from "@/lib/site-content";
import { Timeline } from "../components/Timeline";

const title = "Prospective Members";
const description =
  "MECG recruits students of all majors. See the recruitment timeline — meet us, apply, interview — plus event dates, FAQs, and what life in the club actually looks like.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/prospective-members" },
  openGraph: { title, description },
};

export default function ProspectiveMembersPage() {
  return (
    <main>
      <section className="grid-bg relative overflow-hidden px-5 pb-16 pt-36 md:px-8 md:pb-24 md:pt-44">
        <div className="orb right-[-10rem] top-[-12rem] h-[30rem] w-[30rem] bg-[var(--orange-dark)]" />
        <div className="container relative">
          <p className="annotation annotation-accent" data-reveal>
            Sheet 05 — Prospective Members
          </p>
          <h1 className="display-xl mt-6 max-w-6xl text-white" data-split>
            Join the <span className="text-ghost">machine.</span>
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-white/62" data-reveal>
            MECG is open to students of all majors who want to explore consulting, gain client experience, and build community.
          </p>
          <div className="mt-10 flex flex-wrap gap-3" data-reveal>
            <a
              href="/apply"
              data-magnetic
              className="focus-ring rounded-full bg-[var(--orange)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-white hover:text-[var(--navy-950)]"
            >
              Login / Apply
            </a>
            <a
              href="/apply/checkin"
              data-magnetic
              className="focus-ring rounded-full border border-white/16 px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-white/40 hover:text-white"
            >
              Event Check-In
            </a>
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
            {recruitmentCycle.archiveLabel}
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
            Q&A
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2" data-reveal-group>
            {faqs.map((faq) => (
              <article key={faq.question} className="panel card-hover rounded-[1.35rem] p-6" data-reveal>
                <h3 className="font-diplay text-2xl font-bold uppercase tracking-[-0.04em] text-white">
                  {faq.question}
                </h3>
                <p className="mt-4 leading-relaxed text-white/56">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
