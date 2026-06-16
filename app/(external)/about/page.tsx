import React from "react";
import { history, presidentWelcome } from "@/lib/site-content";

export const metadata = {
  title: "About — MECG",
  description: "Learn about Michigan Engineering Consulting Group.",
};

export default function AboutPage() {
  return (
    <main>
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
            MECG gives students hands-on consulting experience while helping organizations solve meaningful challenges.
          </p>
          <div className="dim-rule mt-12" data-reveal />
        </div>
      </section>

      <section className="sheet px-5 py-20 md:px-8 md:py-28">
        <div className="container">
          <p className="annotation !text-[rgba(5,9,20,0.45)]" data-reveal>
            President&apos;s Welcome
          </p>
          <h2 className="display mt-5 max-w-4xl text-5xl uppercase text-[var(--navy-950)] md:text-7xl" data-split>
            Welcome to MECG.
          </h2>
          <div className="mt-10 max-w-3xl space-y-5 text-lg leading-relaxed text-[var(--on-paper-muted)]" data-reveal-group>
            {presidentWelcome.map((paragraph) => (
              <p key={paragraph} data-reveal>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

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
              Fig. 02.1 — History
            </p>
            <h2 className="display mt-5 text-5xl uppercase text-white md:text-6xl" data-split>
              Founded to close the consulting access gap.
            </h2>
          </div>
          <div className="max-w-2xl space-y-6 border-t border-white/10 pt-8 text-lg leading-relaxed text-white/56" data-reveal-group>
            {history.map((paragraph) => (
              <p key={paragraph} data-reveal>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
