import React from "react";
import type { Metadata } from "next";
import { faqs } from "@/lib/site-content";
import { CommunityPhotoStrip } from "@/components/site/CommunityPhotos";
import HeroGears from "./components/HeroGears";

const title = "MECG — Michigan Engineering Consulting Group";
const description =
  "Multifaceted. Driven. Inclusive. MECG is a pro-bono, student-led consulting organization at the University of Michigan, open to students of every major.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description },
};

export default function Home() {
  return (
    <main>
      <section className="grid-bg relative flex min-h-svh flex-col justify-center overflow-hidden px-5 pb-16 pt-36 md:px-8 md:pb-24 md:pt-44">
        <div className="orb right-[-12rem] top-[-12rem] h-[34rem] w-[34rem] bg-[var(--blue)]" />
        <div className="orb bottom-[-14rem] left-[-12rem] h-[28rem] w-[28rem] bg-[var(--orange-dark)]" />

        {/* WebGL gear assembly — full-bleed stage, weighted right behind the type. */}
        <div className="pointer-events-none absolute inset-0 lg:left-auto lg:w-[58%]">
          <HeroGears />
        </div>

        <div className="container relative">
          <p className="annotation annotation-accent" data-reveal>
            Michigan Engineering Consulting Group
          </p>

          <h1 className="display-xl mt-6 max-w-6xl text-white" data-split>
            Multifaceted.
            <br />
            <span className="text-ghost">Driven.</span>
            <br />
            Inclusive.
          </h1>

          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-white/62" data-reveal>
            MECG is a pro-bono, student-led consulting organization at the University of Michigan.
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
              href="/member-login"
              data-magnetic
              className="focus-ring rounded-full border border-white/16 px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-white/40 hover:text-white"
            >
              Member Login
            </a>
          </div>

          <div className="dim-rule mt-12" data-reveal />
        </div>
      </section>

      

            <div className="py-10 md:py-14"><CommunityPhotoStrip /></div>



<section className="px-5 pb-24 md:px-8">
        <div className="container">
          <p className="annotation annotation-accent" data-reveal>
            Fig. 03 — Q&A
          </p>

          <h2 className="display mt-5 text-5xl uppercase text-white md:text-7xl" data-split>
            Quick answers.
          </h2>

          <div className="mt-10 grid gap-4" data-reveal-group>
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group panel card-hover rounded-[1.35rem] p-0"
                data-reveal
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 p-6">
                  <h3 className="font-display text-2xl font-bold uppercase tracking-[-0.04em] text-white md:text-3xl">
                    {faq.question}
                  </h3>

                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 font-mono text-lg font-bold text-[var(--orange)] transition group-open:rotate-45">
                    +
                  </span>
                </summary>

                <div className="border-t border-white/10 px-6 pb-6 pt-5">
                  <p className="max-w-4xl text-lg leading-relaxed text-white/60">
                    {faq.answer}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
