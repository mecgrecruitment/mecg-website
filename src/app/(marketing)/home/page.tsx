import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/reveal";
import SectionLabel from "@/components/section-label";
import {
  FEATURED_ENGAGEMENT,
  PAST_PROJECTS,
  SEMESTER_FACTS,
} from "@/lib/site-content";

const PROOF_POINTS = [
  ["70+", "active members"],
  ["30+", "partner organizations"],
  ["$0", "consulting fees"],
] as const;

const PROCESS_STEPS = [
  ["01", "Frame the decision", "We turn a broad challenge into one question a team can answer in a semester."],
  ["02", "Build the evidence", "Students research, interview, analyze, and check assumptions with your team."],
  ["03", "Hand off the work", "You receive a clear recommendation, supporting files, and practical next steps."],
] as const;

export const metadata: Metadata = {
  title: "Michigan Engineering Consulting Group",
  description: "Pro-bono, student-led consulting at the University of Michigan.",
};

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none">
      <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="overflow-hidden bg-white text-mecg-navy">
      <section className="relative bg-mecg-navy text-white">
        <div className="pointer-events-none absolute inset-0 opacity-40 hero-grid" />
        <div className="relative mx-auto grid max-w-[90rem] lg:min-h-[calc(100svh-16rem)] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative z-10 flex flex-col justify-center px-6 py-16 sm:px-10 sm:py-20 lg:px-12 lg:py-24 xl:pl-24">
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-mecg-orange">
              University of Michigan · Est. 2023
            </p>
            <h1 className="mt-6 max-w-2xl text-balance text-[clamp(3rem,5.4vw,6.7rem)] font-semibold leading-[0.94] tracking-[-0.055em]">
              Better decisions need better evidence.
            </h1>
            <p className="mt-7 max-w-lg text-pretty text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
              Michigan students spend a semester turning one important question into a recommendation your organization can use.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="/work" className="button-primary group">
                Start a project
                <span className="transition-transform duration-150 group-hover:translate-x-0.5"><ArrowIcon /></span>
              </Link>
              <Link href="/join" className="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/75 transition-colors duration-150 hover:text-white">
                Join the team
                <span className="transition-transform duration-150 group-hover:translate-x-0.5"><ArrowIcon /></span>
              </Link>
            </div>
          </div>

          <div className="relative min-h-[27rem] lg:min-h-0">
            <Image
              src="/mecg/members-professional.png"
              alt="MECG members visiting PwC in Chicago"
              fill
              priority
              sizes="(min-width: 1024px) 61vw, 100vw"
              className="object-cover object-[53%_72%]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-mecg-navy via-mecg-navy/5 to-transparent lg:w-1/3" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-mecg-navy/85 via-mecg-navy/20 to-transparent px-6 pb-6 pt-24 sm:px-10 lg:px-12">
              <div className="ml-auto flex max-w-sm items-end justify-between gap-6 border-t border-white/25 pt-4">
                <p className="max-w-[15rem] text-sm leading-5 text-white/75">Student-led. Engineering-minded. Open to every major.</p>
                <p className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white/55">Chicago · 2026</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/12">
          <div className="mx-auto grid max-w-6xl grid-cols-3 px-6 sm:px-10">
            {PROOF_POINTS.map(([value, label], index) => (
              <div key={label} className={`py-6 sm:flex sm:items-baseline sm:gap-3 sm:py-7 ${index > 0 ? "border-l border-white/12 pl-5 sm:pl-8" : ""}`}>
                <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p>
                <p className="mt-1 text-[0.64rem] uppercase tracking-[0.12em] text-white/52 sm:mt-0 sm:text-xs sm:normal-case sm:tracking-normal">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paper px-6 py-14 sm:px-10 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <SectionLabel number="01">Trusted with real questions</SectionLabel>
              <h2 className="mt-5 max-w-md text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Work shaped with organizations, not for a classroom.
              </h2>
            </div>
            <p className="max-w-xl text-pretty text-base leading-7 text-mecg-navy/60 lg:justify-self-end">
              Our partners bring decisions with real constraints. MECG brings a focused student team, a semester of work, and a recommendation built to travel beyond the final presentation.
            </p>
          </div>

          <div className="mt-10 grid border-y border-mecg-navy/12 sm:grid-cols-3">
            {PAST_PROJECTS.map((project, index) => (
              <a
                key={project.name}
                href={project.website}
                target="_blank"
                rel="noreferrer"
                aria-label={`${project.name}, past MECG partner, opens in a new tab`}
                className={`group flex min-h-32 items-center justify-center px-8 py-8 transition-colors duration-150 hover:bg-white/60 sm:min-h-40 sm:py-10 ${index > 0 ? "border-t border-mecg-navy/12 sm:border-l sm:border-t-0" : ""}`}
              >
                <Image
                  src={project.logo}
                  alt={`${project.name} logo`}
                  width={project.width}
                  height={project.height}
                  sizes="(min-width: 640px) 22rem, 70vw"
                  className="max-h-16 w-auto max-w-[15rem] object-contain grayscale transition-[filter,opacity] duration-150 group-hover:grayscale-0"
                />
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-10 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <Reveal className="relative min-h-[25rem] overflow-hidden bg-mecg-navy sm:min-h-[34rem]">
            <Image
              src="/mecg/members-in-chicago.jpg"
              alt="MECG members together during a Chicago visit"
              fill
              sizes="(min-width: 1024px) 48rem, 100vw"
              className="object-cover object-center image-outline transition-transform duration-700 hover:scale-[1.02]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-mecg-navy/90 to-transparent px-6 pb-6 pt-24 text-white">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.17em] text-white/60">A team built around one question</p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <SectionLabel number="02">Featured engagement</SectionLabel>
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.16em] text-mecg-orange-ink">{FEATURED_ENGAGEMENT.location}</p>
            <h2 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-[2.75rem]">
              {FEATURED_ENGAGEMENT.client}
            </h2>
            <p className="mt-7 text-pretty text-2xl leading-snug text-mecg-navy/86">
              {FEATURED_ENGAGEMENT.question}
            </p>
            <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-mecg-navy/60">
              {FEATURED_ENGAGEMENT.body}
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-px bg-mecg-navy/12">
              {SEMESTER_FACTS.slice(0, 4).map(([term, value]) => (
                <div key={term} className="bg-white px-5 py-4">
                  <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-mecg-navy/48">{term}</dt>
                  <dd className="mt-1.5 text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <Link href={FEATURED_ENGAGEMENT.href} className="group mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-mecg-blue transition-colors duration-150 hover:text-mecg-navy">
              See how engagements work
              <span className="transition-transform duration-150 group-hover:translate-x-0.5"><ArrowIcon /></span>
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="bg-mecg-navy px-6 py-16 text-white sm:px-10 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
            <div>
              <SectionLabel number="03" className="text-mecg-orange">How the work moves</SectionLabel>
              <h2 className="mt-5 max-w-lg text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-[2.75rem]">
                One semester. One useful answer.
              </h2>
            </div>
            <p className="max-w-lg text-pretty text-base leading-7 text-white/58 lg:justify-self-end">
              The scope stays narrow on purpose. It gives the team enough time to understand the decision, test the evidence, and make the handoff useful.
            </p>
          </div>
          <ol className="mt-12 grid gap-px bg-white/12 lg:grid-cols-3">
            {PROCESS_STEPS.map(([number, title, body], index) => (
              <Reveal key={number} delay={index * 70} className="bg-mecg-navy px-6 py-7 sm:px-8 sm:py-9">
                <p className="font-mono text-xs text-mecg-orange">{number}</p>
                <h3 className="mt-7 text-2xl font-semibold tracking-tight sm:mt-8">{title}</h3>
                <p className="mt-4 text-pretty text-sm leading-6 text-white/58">{body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-paper px-6 py-16 sm:px-10 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <SectionLabel number="04">Built at Michigan</SectionLabel>
            <h2 className="mt-5 max-w-lg text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-[2.75rem]">
              Serious work. Real student life.
            </h2>
            <p className="mt-6 max-w-lg text-pretty text-base leading-7 text-mecg-navy/60">
              MECG brings together students across Michigan who want to learn by doing. Members lead client work, teach each other, and build the organization together.
            </p>
            <Link href="/team" className="group mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-mecg-blue transition-colors duration-150 hover:text-mecg-navy">
              Meet the team
              <span className="transition-transform duration-150 group-hover:translate-x-0.5"><ArrowIcon /></span>
            </Link>
          </div>
          <div className="grid grid-cols-[1.15fr_0.85fr] gap-3 sm:gap-5">
            <div className="relative min-h-[26rem] overflow-hidden sm:min-h-[34rem]">
              <Image src="/mecg/members-outdoors.jpg" alt="MECG members at a Michigan student event" fill sizes="(min-width: 1024px) 34rem, 60vw" className="object-cover object-[48%_center] image-outline" />
            </div>
            <div className="relative mt-12 min-h-[21rem] overflow-hidden sm:min-h-[28rem]">
              <Image src="/mecg/members-together.jpg" alt="MECG members spending time together" fill sizes="(min-width: 1024px) 24rem, 40vw" className="object-cover object-center image-outline" />
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 sm:px-10 sm:py-16">
        <div className="mx-auto grid max-w-6xl overflow-hidden bg-mecg-blue text-white lg:grid-cols-2">
          <div className="px-7 py-8 sm:px-10 sm:py-11">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-white/60">For organizations</p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Bring us the decision that keeps getting pushed.</h2>
            <Link href="/work" className="button-light group mt-7">
              Discuss a project
              <span className="transition-transform duration-150 group-hover:translate-x-0.5"><ArrowIcon /></span>
            </Link>
          </div>
          <div className="border-t border-white/20 px-7 py-8 sm:px-10 sm:py-11 lg:border-l lg:border-t-0">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-white/60">For students</p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Learn consulting by doing the work.</h2>
            <Link href="/join" className="button-ghost-light group mt-7">
              Join MECG
              <span className="transition-transform duration-150 group-hover:translate-x-0.5"><ArrowIcon /></span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
