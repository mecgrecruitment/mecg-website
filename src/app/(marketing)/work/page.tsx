import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SectionLabel from "@/components/section-label";
import { CLIENT_FAQS, ENGAGEMENT_STEPS, PAST_PROJECTS } from "@/lib/site-content";
import ProjectInquiryForm from "./project-inquiry-form";

const CAPABILITIES = [
  ["Market and customer research", "Which customer segment should we prioritize next?"],
  ["Growth strategy", "Where does the strongest expansion opportunity sit?"],
  ["Operations improvement", "Which part of this process creates the most avoidable friction?"],
  ["Product and technical assessment", "Which option best fits the business case and implementation constraints?"],
  ["Data and decision support", "What does the available evidence support, and where are its limits?"],
] as const;

const ENGAGEMENT_FACTS = [
  ["Cost", "Pro-bono"],
  ["Duration", "One semester, or longer when needed"],
  ["Team", "6-8 MECG members"],
  ["Meetings", "Set with the client"],
  ["Confidentiality", "NDAs supported"],
] as const;

const GOOD_FIT = [
  "A specific decision needs research or analysis.",
  "One client contact can provide context and feedback.",
  "The team can access the people or information the work requires.",
  "The timeline allows for a semester of thoughtful work.",
] as const;

const POOR_FIT = [
  "Emergency turnaround or full-time implementation.",
  "Legal, medical, or other regulated professional advice.",
  "A project without an available client owner.",
  "Work that depends on data the team cannot responsibly access.",
] as const;

export const metadata: Metadata = {
  title: "Client work",
  description: "See MECG's past clients, project model, and how to begin a pro-bono consulting engagement.",
};

export default function WorkPage() {
  return (
    <main className="bg-white text-mecg-navy">
      <section aria-labelledby="work-title" className="relative overflow-hidden border-b border-mecg-navy/10 px-6 py-14 sm:py-18">
        <div className="hero-grid absolute inset-0 opacity-35" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl">
          <SectionLabel number="01" className="text-[#a83e0b]">Client work</SectionLabel>
          <h1 id="work-title" className="mt-5 max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-7xl">A focused team for an important decision.</h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-mecg-navy/60 sm:text-xl">MECG runs pro-bono consulting engagements with organizations across industries. Most projects span a semester, with longer partnerships when the scope requires it.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#project-inquiry" className="button-primary text-mecg-navy">Discuss a project <span aria-hidden="true">→</span></a>
            <a href="#past-projects" className="button-secondary">See past projects <span aria-hidden="true">↓</span></a>
          </div>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-mecg-navy/45">30+ organizations served · University of Michigan · Pro-bono</p>
        </div>
      </section>

      <section id="past-projects" aria-labelledby="past-projects-title" className="scroll-mt-20 border-b border-mecg-navy/10 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionLabel number="01.1" className="text-[#a83e0b]">Past projects</SectionLabel>
          <div className="mt-5 grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <h2 id="past-projects-title" className="max-w-xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Organizations have trusted MECG with real work.</h2>
            <p className="max-w-xl text-pretty text-lg leading-8 text-mecg-navy/60">These organizations have worked with MECG in the past. Full case studies will be added as project details and outcomes are approved.</p>
          </div>
          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            {PAST_PROJECTS.map((project, index) => (
              <a key={project.name} href={project.website} target="_blank" rel="noreferrer" aria-label={`${project.name}, past MECG project, opens in a new tab`} className="group flex min-h-80 flex-col rounded-[2rem] bg-white p-7 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] transition-transform active:scale-[0.96] sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/55">Past MECG project</p>
                  <span className="font-mono text-xs text-mecg-navy/35">00{index + 1}</span>
                </div>
                <div className="flex h-36 items-center justify-center px-5 py-6">
                  <Image src={project.logo} alt={`${project.name} logo`} width={project.width} height={project.height} sizes="(min-width: 1024px) 24rem, 80vw" className="max-h-28 w-auto max-w-full object-contain" />
                </div>
                <div className="border-t border-mecg-navy/10 pt-5">
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-mecg-navy/45">{project.industry}</p>
                  <h3 className="mt-2 flex items-center justify-between gap-4 text-xl font-semibold"><span>{project.name}</span><span className="text-mecg-blue transition-transform group-hover:translate-x-1" aria-hidden="true">↗</span></h3>
                  <p className="mt-2 text-sm leading-6 text-mecg-navy/50">Case study in development.</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="capabilities-title" className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionLabel number="01.2" className="text-[#a83e0b]">What we take on</SectionLabel>
          <h2 id="capabilities-title" className="mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Questions that benefit from evidence and an outside point of view.</h2>
          <div className="mt-8 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
            {CAPABILITIES.map(([title, question], index) => (
              <article key={title} className="grid gap-3 py-5 sm:grid-cols-[3rem_16rem_1fr] sm:items-start">
                <span className="font-mono text-xs text-[#a83e0b]">0{index + 1}</span>
                <h3 className="font-semibold">{title}</h3>
                <p className="max-w-2xl leading-7 text-mecg-navy/60">&quot;{question}&quot;</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="engagement-title" className="bg-mecg-blue/[0.08] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionLabel number="01.3" className="text-[#a83e0b]">The engagement</SectionLabel>
          <h2 id="engagement-title" className="mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">A practical model for focused work.</h2>
          <dl className="mt-8 grid overflow-hidden rounded-2xl bg-mecg-navy text-white sm:grid-cols-2 lg:grid-cols-5">
            {ENGAGEMENT_FACTS.map(([term, detail]) => (
              <div key={term} className="border-b border-white/10 p-5 last:border-b-0 sm:border-r lg:border-b-0">
                <dt className="font-mono text-xs uppercase tracking-[0.14em] text-white/45">{term}</dt>
                <dd className="mt-3 text-sm leading-6 text-white/80">{detail}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
            {ENGAGEMENT_STEPS.map(([number, title, copy, output]) => (
              <article key={number} className="grid gap-4 py-6 sm:grid-cols-[4rem_13rem_1fr] lg:grid-cols-[4rem_13rem_1fr_0.8fr] lg:items-start">
                <span className="font-mono text-sm text-[#a83e0b]">{number}</span>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="max-w-xl leading-7 text-mecg-navy/60">{copy}</p>
                <p className="rounded-xl bg-white p-4 text-sm leading-6 text-mecg-navy/60 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.07)]"><span className="block font-mono text-[0.68rem] uppercase tracking-[0.14em] text-mecg-navy/40">Output</span><span className="mt-2 block">{output}</span></p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="fit-title" className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionLabel number="01.4" className="text-[#a83e0b]">Project fit</SectionLabel>
          <h2 id="fit-title" className="mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">A good project needs commitment on both sides.</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <article className="rounded-[2rem] bg-mecg-navy p-7 text-white sm:p-8">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-orange">A strong fit</p>
              <ul className="mt-6 divide-y divide-white/10 border-y border-white/10">
                {GOOD_FIT.map((item) => <li key={item} className="flex gap-3 py-4 leading-7 text-white/75"><span className="text-mecg-orange" aria-hidden="true">✓</span><span>{item}</span></li>)}
              </ul>
            </article>
            <article className="rounded-[2rem] bg-mecg-blue/[0.1] p-7 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.07)] sm:p-8">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/55">Probably not a fit</p>
              <ul className="mt-6 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
                {POOR_FIT.map((item) => <li key={item} className="flex gap-3 py-4 leading-7 text-mecg-navy/65"><span className="text-mecg-blue" aria-hidden="true">×</span><span>{item}</span></li>)}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section aria-labelledby="questions-title" className="border-y border-mecg-navy/10 bg-mecg-blue/[0.08] px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-9 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <SectionLabel number="01.5" className="text-[#a83e0b]">Questions</SectionLabel>
            <h2 id="questions-title" className="mt-5 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Before we begin.</h2>
            <p className="mt-5 max-w-md leading-7 text-mecg-navy/60">You do not need a perfect scope. Start with the decision, the deadline, and what has already been tried.</p>
          </div>
          <div className="divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
            {CLIENT_FAQS.map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 font-semibold"><span>{question}</span><span className="text-[#a83e0b] transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
                <p className="mt-3 max-w-2xl pr-8 leading-7 text-mecg-navy/60">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="project-inquiry" aria-labelledby="inquiry-title" className="scroll-mt-20 px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-9 lg:grid-cols-[0.65fr_1.35fr] lg:items-start">
          <div>
            <SectionLabel number="01.6" className="text-[#a83e0b]">Start a conversation</SectionLabel>
            <h2 id="inquiry-title" className="mt-5 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Bring us a decision worth working through.</h2>
            <p className="mt-5 max-w-md leading-7 text-mecg-navy/60">Share enough context for the board to understand the question and timing. We reply within one week.</p>
            <p className="mt-5 text-sm text-mecg-navy/55">Prefer to write directly? <a href="mailto:mecg-board@umich.edu?subject=Project%20inquiry" className="font-semibold text-mecg-blue underline underline-offset-4">mecg-board@umich.edu</a></p>
          </div>
          <ProjectInquiryForm />
        </div>
      </section>

      <section className="border-t border-mecg-navy/10 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <p className="text-lg font-medium">Want to know who leads MECG’s consulting work?</p>
          <Link href="/team" className="inline-flex min-h-11 items-center text-sm font-semibold text-mecg-blue">Meet the board <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </main>
  );
}
