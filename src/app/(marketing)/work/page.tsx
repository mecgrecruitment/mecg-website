import type { Metadata } from "next";
import Link from "next/link";
import PageIntro from "@/components/page-intro";
import ProjectCarousel from "@/components/project-carousel";
import SectionLabel from "@/components/section-label";
import { CLIENT_FAQS, ENGAGEMENT_STEPS, PROJECT_OUTPUTS } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Client work",
  description: "See the questions MECG teams take on and how a semester-long client engagement works.",
};

export default function WorkPage() {
  return (
    <main className="bg-white text-mecg-navy">
      <PageIntro number="01" label="Client work" title="A clear answer to a real decision." copy="MECG works with organizations on semester-long questions that need research, analysis, and an outside point of view. We scope the work around a decision, not a stack of slides." />
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
            <SectionLabel number="01.1">What we take on</SectionLabel>
            <h2 className="mt-5 max-w-xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Questions that need a fresh set of eyes.</h2>
            </div>
            <div>
              <p className="max-w-xl text-pretty text-lg leading-8 text-mecg-navy/60">A project begins with one decision. The team then builds the research and analysis needed to make that decision with confidence.</p>
              <div className="mt-5 flex flex-wrap gap-2">
              {["Market research", "Process improvement", "Growth strategy", "Product planning", "Data analysis"].map((area) => (
                <span key={area} className="rounded-full bg-mecg-blue/[0.1] px-4 py-2 font-mono text-xs text-mecg-navy/65 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.06)]">{area}</span>
              ))}
              </div>
            </div>
          </div>
          <div className="mt-9"><ProjectCarousel /></div>
        </div>
      </section>
      <section className="bg-mecg-blue/[0.08] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionLabel number="01.2">The engagement</SectionLabel>
          <h2 className="mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Useful work starts with a tight question.</h2>
          <div className="mt-8 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
            {ENGAGEMENT_STEPS.map(([number, title, copy]) => <div key={number} className="grid gap-4 py-6 sm:grid-cols-[4rem_15rem_1fr] sm:items-start"><span className="font-mono text-sm text-mecg-orange">{number}</span><h3 className="text-xl font-semibold">{title}</h3><p className="max-w-2xl leading-7 text-mecg-navy/60">{copy}</p></div>)}
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {PROJECT_OUTPUTS.map(([title, copy], index) => <article key={title} className="rounded-2xl bg-white p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.07)]"><p className="font-mono text-xs text-mecg-orange">0{index + 1}</p><h3 className="mt-4 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-mecg-navy/60">{copy}</p></article>)}
          </div>
        </div>
      </section>
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-9 lg:grid-cols-[0.72fr_1.28fr]">
          <div><SectionLabel number="01.3">Before we begin</SectionLabel><h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">A useful first conversation.</h2><p className="mt-5 max-w-md leading-7 text-mecg-navy/60">Tell us the decision, the deadline, and what has already been tried. The question does not need to be perfectly scoped.</p><a href="mailto:mecg-board@umich.edu?subject=Project%20inquiry" className="button-primary mt-7">Discuss a project ↗</a></div>
          <div className="divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">{CLIENT_FAQS.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-semibold"><span>{question}</span><span className="text-mecg-orange transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary><p className="mt-3 max-w-2xl pr-8 leading-7 text-mecg-navy/60">{answer}</p></details>)}</div>
        </div>
      </section>
      <section className="px-6 py-10"><div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 sm:flex-row sm:items-center"><p className="text-lg font-medium">Looking for the people behind the work?</p><Link href="/team" className="text-sm font-semibold text-mecg-blue">Meet the board →</Link></div></section>
    </main>
  );
}
