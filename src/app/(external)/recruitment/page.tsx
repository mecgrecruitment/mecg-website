import React from "react";
import { faqs, recruitmentEvents } from "../../../lib/site-content";

export const metadata = {
  title: "Recruitment — MECG",
  description:
    "Apply to the Michigan Engineering Consulting Group — Winter 2026 recruitment timeline, events, and FAQ.",
};

const typeStyles: Record<string, string> = {
  "Open Rush": "border-[var(--orange)]/50 text-[var(--orange)]",
  "Closed Rush": "border-[var(--blue-soft)]/50 text-[var(--blue-soft)]",
  "Invite Only": "border-white/25 text-white/55",
};

export default function RecruitmentPage() {
  return (
    <main>
      {/* Sheet header */}
      <section className="grid-bg relative overflow-hidden px-5 pb-16 pt-36 md:px-8 md:pb-24 md:pt-44">
        <div className="orb right-[-12rem] top-[-10rem] h-[30rem] w-[30rem] bg-[var(--orange-dark)]" />
        <div className="container relative">
          <p className="annotation annotation-accent" data-reveal>
            Sheet 05 — Recruitment · Winter 2026
          </p>
          <h1 className="display-xl mt-6 max-w-6xl text-white" data-split>
            Show us how <span className="text-ghost">you think.</span>
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-white/62" data-reveal>
            An open-rush process designed to help you learn about the club,
            meet members, and demonstrate how you approach problems.
          </p>
          <div className="mt-10 flex flex-wrap gap-3" data-reveal>
            <a
              href="/apply"
              data-magnetic
              className="focus-ring rounded-full bg-[var(--orange)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-white hover:text-[var(--navy-950)]"
            >
              Apply now
            </a>
            <a
              href="#timeline"
              className="focus-ring rounded-full border border-white/16 px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-white/40 hover:text-white"
            >
              See the timeline
            </a>
          </div>
          <div className="dim-rule mt-12" data-reveal />
        </div>
      </section>

      {/* Timeline — the process ledger. */}
      <section id="timeline" className="section border-y border-white/10 bg-white/[0.025]">
        <div className="container">
          <p className="annotation annotation-accent" data-reveal>
            Fig. 05.1 — Winter 2026 timeline
          </p>
          <h2 className="display mt-5 text-5xl uppercase text-white md:text-7xl" data-split>
            Ten events. One decision.
          </h2>

          <div className="mt-12 border-t border-white/10" data-reveal-group>
            {recruitmentEvents.map((event) => (
              <article
                key={event.code}
                className="card-hover grid gap-5 border-b border-white/10 py-7 md:grid-cols-[6rem_1fr_1fr_14rem] md:items-baseline"
                data-reveal
              >
                <p className="font-mono text-xl font-bold text-[var(--orange)]">{event.code}</p>
                <div>
                  <h3 className="font-display text-2xl font-bold uppercase tracking-[-0.04em] text-white md:text-3xl">
                    {event.title}
                  </h3>
                  <span
                    className={`annotation mt-3 inline-block rounded-full border px-3 py-1.5 ${
                      typeStyles[event.type] ?? "border-white/25 text-white/55"
                    }`}
                  >
                    {event.type}
                  </span>
                </div>
                <p className="max-w-md leading-relaxed text-white/50">{event.body}</p>
                <div className="font-mono text-xs uppercase leading-relaxed tracking-[0.08em] text-white/45">
                  <p>{event.date}</p>
                  <p>{event.time}</p>
                  <p className="text-white/30">{event.location}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — drawing sheet. */}
      <section className="sheet px-5 py-20 md:px-8 md:py-28">
        <div className="container grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="annotation !text-[rgba(5,9,20,0.45)]" data-reveal>
              Fig. 05.2 — FAQ
            </p>
            <h2 className="display mt-5 text-5xl uppercase text-[var(--navy-950)] md:text-6xl" data-split>
              Asked and answered.
            </h2>
          </div>

          <div className="border-t border-[var(--paper-rule)]" data-reveal-group>
            {faqs.map((faq, i) => (
              <details key={faq.question} className="group border-b border-[var(--paper-rule)]" data-reveal>
                <summary className="focus-ring flex cursor-pointer list-none items-baseline gap-5 py-6 [&::-webkit-details-marker]:hidden">
                  <span className="font-mono text-sm font-bold text-[var(--orange-dark)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display flex-1 text-xl font-bold uppercase tracking-[-0.03em] text-[var(--navy-950)] md:text-2xl">
                    {faq.question}
                  </span>
                  <span
                    className="font-mono text-xl text-[var(--orange-dark)] transition-transform duration-300 group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-7 pl-10 leading-relaxed text-[var(--on-paper-muted)]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
