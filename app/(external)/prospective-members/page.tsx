import React from "react";
import { faqs, recruitmentEvents } from "@/lib/site-content";

export const metadata = {
  title: "Prospective Members — MECG",
  description: "Recruitment information for prospective MECG members.",
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
          <p className="annotation !text-[rgba(5,9,20,0.45)]" data-reveal>
            Recruitment Timeline
          </p>
          <h2 className="display mt-5 max-w-4xl text-5xl uppercase text-[var(--navy-950)] md:text-7xl" data-split>
            Meet us. Apply. Interview.
          </h2>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-reveal-group>
            {recruitmentEvents.map((event) => (
              <article key={event.code} className="rounded-[1rem] border border-[var(--paper-rule)] p-6" data-reveal>
                <p className="font-mono text-sm font-bold text-[var(--orange-dark)]">
                  {event.code} — {event.type}
                </p>
                <h3 className="font-disay mt-5 text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--navy-950)]">
                  {event.title}
                </h3>
                <p className="mt-3 text-sm font-bold uppercase tracking-[0.12em] text-[var(--on-paper-muted)]">
                  {event.date} · {event.time}
                </p>
                <p className="mt-2 text-sm text-[var(--on-paper-muted)]">{event.location}</p>
                <p className="mt-4 leading-relaxed text-[var(--on-paper-muted)]">{event.body}</p>
              </article>
            ))}
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
