import React from "react";
import { pillars } from "../../../lib/site-content";

export const metadata = {
  title: "About — MECG",
  description:
    "Michigan Engineering Consulting Group — a consulting community built for engineering-minded problem solvers at the University of Michigan.",
};

export default function AboutPage() {
  return (
    <main>
      {/* Sheet header */}
      <section className="grid-bg relative overflow-hidden px-5 pb-16 pt-36 md:px-8 md:pb-24 md:pt-44">
        <div className="orb right-[-10rem] top-[-10rem] h-[28rem] w-[28rem] bg-[var(--blue)]" />
        <div className="container relative">
          <p className="annotation annotation-accent" data-reveal>
            Sheet 02 — About MECG
          </p>
          <h1 className="display-xl mt-6 max-w-6xl text-white" data-split>
            Built for problem solvers.
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-white/62" data-reveal>
            Michigan Engineering Consulting Group was founded in 2023 to give
            students of all majors a path into consulting through education,
            client experience, mentorship, and community.
          </p>
          <div className="dim-rule mt-12" data-reveal />
        </div>
      </section>

      {/* Four pillars — the drawing sheet. */}
      <section className="sheet px-5 py-20 md:px-8 md:py-28">
        <div className="container">
          <p className="annotation !text-[rgba(5,9,20,0.45)]" data-reveal>
            Fig. 02.1 — Four pillars
          </p>
          <h2 className="display mt-5 max-w-3xl text-5xl uppercase text-[var(--navy-950)] md:text-7xl" data-split>
            What holds the machine together.
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-[1rem] border border-[var(--paper-rule)] bg-[var(--paper-rule)] md:grid-cols-2 xl:grid-cols-4" data-reveal-group>
            {pillars.map((pillar) => (
              <article
                key={pillar.index}
                className="group bg-[var(--paper)] p-7 transition-colors duration-300 hover:bg-[var(--navy-950)]"
                data-reveal
              >
                <p className="font-mono text-sm font-bold text-[var(--orange-dark)] group-hover:text-[var(--orange)]">
                  {pillar.index}
                </p>
                <h3 className="font-display mt-10 text-2xl font-bold uppercase leading-none tracking-[-0.04em] text-[var(--navy-950)] transition-colors duration-300 group-hover:text-white">
                  {pillar.title}
                </h3>
                <p className="mt-5 leading-relaxed text-[var(--on-paper-muted)] transition-colors duration-300 group-hover:text-white/60">
                  {pillar.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* History */}
      <section className="section relative overflow-hidden">
        <p
          className="display-xl text-ghost pointer-events-none absolute -right-8 top-10 select-none"
          aria-hidden="true"
          data-parallax="0.18"
        >
          2023
        </p>
        <div className="container relative grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="annotation annotation-accent" data-reveal>
              Fig. 02.2 — History
            </p>
            <h2 className="display mt-5 text-5xl uppercase text-white md:text-6xl" data-split>
              Founded to close the consulting access gap.
            </h2>
          </div>
          <div className="max-w-2xl space-y-6 border-t border-white/10 pt-8 text-lg leading-relaxed text-white/56" data-reveal-group>
            <p data-reveal>
              MECG was founded in 2023 by Jonathan Fay and Aaryan Singh with
              the vision of creating a space where students could grow
              personally, professionally, and socially.
            </p>
            <p data-reveal>
              At the time, the University of Michigan had fewer consulting
              opportunities designed for non-business students. MECG filled
              that gap by helping students develop business acumen, gain
              project experience, and collaborate across disciplines.
            </p>
            <p data-reveal>
              Today, MECG continues to prepare students to thrive in consulting
              and beyond by combining analytical work, client service,
              mentorship, and a close community.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
