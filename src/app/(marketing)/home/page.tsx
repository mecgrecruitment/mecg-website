import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/reveal";
import SectionLabel from "@/components/section-label";
import StatsBand from "@/components/stats-band";
import {
  FEATURED_ENGAGEMENT,
  HOMEPAGE_LEADERS,
  PAST_PROJECTS,
  SEMESTER_FACTS,
} from "@/lib/site-content";

const FEATURED_CLIENT = PAST_PROJECTS.find((project) => project.name === FEATURED_ENGAGEMENT.client);

export const metadata: Metadata = {
  title: "Michigan Engineering Consulting Group",
  description: "Pro-bono, student-led consulting at the University of Michigan.",
};

export default function HomePage() {
  return (
    <main className="bg-white text-mecg-navy">
      <section className="bg-mecg-navy text-white">
        <div className="grid lg:grid-cols-2">
          <div className="flex flex-col justify-center px-6 py-14 sm:px-10 lg:py-20 xl:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-mecg-orange">
              MECG / University of Michigan / Est. 2023
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem] lg:leading-[1.06]">
              Student consulting for decisions that need evidence.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/65">
              MECG is a pro-bono team at Michigan. One question, one semester, a recommendation the client can use.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/work" className="button-primary">
                Discuss a project
              </Link>
              <Link href="/join" className="button-dark">
                Join MECG
              </Link>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="relative min-h-[20rem] flex-1 outline outline-1 -outline-offset-1 outline-white/12 sm:min-h-[26rem] lg:min-h-[30rem]">
              <Image
                src="/mecg/members-professional.png"
                alt="MECG members in business attire"
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover object-center"
              />
            </div>
            <p className="px-6 py-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-white/55">
              Fig. 01 — 2026 cohort, Ann Arbor MI
            </p>
          </div>
        </div>
        <StatsBand />
      </section>

      <section className="paper-band border-b border-mecg-navy/10 px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <SectionLabel number="00.2">Selected organizations</SectionLabel>
          <ul className="mt-8">
            {PAST_PROJECTS.map((project, index) => (
              <li key={project.name} className="border-t border-mecg-navy/10">
                <Reveal delay={index * 60}>
                  <a
                    href={project.website}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${project.name}, past MECG project, opens in a new tab`}
                    className="group grid min-h-16 items-center gap-4 py-4 sm:grid-cols-[3rem_1fr_auto]"
                  >
                    <span className="font-mono text-xs text-mecg-navy/60 transition-colors duration-150 group-hover:text-mecg-orange-ink">
                      0{index + 1}
                    </span>
                    <span className="text-xl font-semibold sm:text-2xl">{project.name}</span>
                    <span className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/60">
                      {project.industry}
                    </span>
                  </a>
                </Reveal>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-mecg-navy/10 pt-6 text-sm text-mecg-navy/60">And 30+ others since 2023.</p>
        </div>
      </section>

      <section className="border-b border-mecg-navy/10 px-6 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <Reveal>
            <SectionLabel number="00.3">Featured engagement</SectionLabel>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {FEATURED_ENGAGEMENT.client}
            </h2>
            <p className="mt-3 text-sm text-mecg-navy/60">{FEATURED_ENGAGEMENT.location}</p>
            <p className="mt-8 text-2xl leading-snug text-mecg-navy/85">
              {FEATURED_ENGAGEMENT.question}
            </p>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-mecg-navy/60">
              {FEATURED_ENGAGEMENT.body}
            </p>
            <Link href={FEATURED_ENGAGEMENT.href} className="mt-8 inline-flex text-sm font-semibold text-mecg-blue hover:text-mecg-navy">
              See how an engagement works
            </Link>
          </Reveal>
          <Reveal delay={60} className="flex flex-col bg-paper outline outline-1 -outline-offset-1 outline-mecg-navy/10">
            <div className="flex min-h-56 flex-1 items-center justify-center px-10 py-14 lg:min-h-[16rem]">
              {FEATURED_CLIENT ? (
                <Image
                  src={FEATURED_CLIENT.logo}
                  alt={`${FEATURED_CLIENT.name} logo`}
                  width={FEATURED_CLIENT.width}
                  height={FEATURED_CLIENT.height}
                  sizes="(min-width: 1024px) 24rem, 80vw"
                  className="max-h-20 w-auto max-w-full object-contain"
                />
              ) : null}
            </div>
            <dl className="border-t border-mecg-navy/10 px-6 py-5 font-mono text-xs uppercase tracking-[0.14em]">
              {[
                ["Client", FEATURED_ENGAGEMENT.client],
                ["Sector", FEATURED_ENGAGEMENT.industry],
                ["Term", "One semester"],
                ["Status", "Case study pending client approval"],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[5rem_1fr] gap-3 py-1.5">
                  <dt className="text-mecg-navy/60">{label} /</dt>
                  <dd className="text-mecg-navy">{value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-mecg-navy/10 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionLabel number="00.4">Semester structure</SectionLabel>
          <h2 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            How a semester is structured
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-mecg-navy/60">
            A team of Michigan students works a single question for the term,
            then hands off a recommendation the client can keep.
          </p>
          <dl className="mt-12 grid gap-px bg-mecg-navy/10 sm:grid-cols-2 lg:grid-cols-4">
            {SEMESTER_FACTS.map(([term, value], index) => (
              <Reveal key={term} delay={index * 60} className="bg-white px-6 py-7">
                <dt className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-mecg-navy/60">{term}</dt>
                <dd className="mt-3 text-2xl">{value}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-mecg-navy/10 px-6 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <SectionLabel number="00.5">People</SectionLabel>
            <h2 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              The people who do the work
            </h2>
            <p className="mt-6 max-w-md text-lg leading-8 text-mecg-navy/60">
              Members come from across the University of Michigan. Client work
              is led by students who also run the organization.
            </p>
            <ul className="mt-8 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
              {HOMEPAGE_LEADERS.map((person) => (
                <li key={person.name} className="flex items-center gap-4 py-3.5">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden bg-mecg-navy/5">
                    <Image src={person.src} alt="" fill sizes="44px" className="object-cover object-top" />
                  </span>
                  <span className="font-medium">{person.name}</span>
                  <span className="ml-auto text-sm text-mecg-navy/60">{person.role}</span>
                </li>
              ))}
            </ul>
            <Link href="/team" className="mt-6 inline-flex text-sm font-semibold text-mecg-blue hover:text-mecg-navy">
              Meet the board
            </Link>
          </div>
          <div className="relative min-h-[28rem] overflow-hidden outline outline-1 -outline-offset-1 outline-mecg-navy/10 sm:min-h-[36rem]">
            <Image
              src="/mecg/members-board-stairs.png"
              alt="MECG members in business attire on campus"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover object-[center_20%]"
            />
          </div>
        </div>
      </section>

      <section className="bg-mecg-navy px-6 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionLabel number="00.6" className="text-mecg-orange">Alumni</SectionLabel>
          <h2 className="mt-5 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Where the work goes next
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-8 text-white/60">
            Alumni have taken MECG experience into engineering, finance,
            technology, and consulting teams.
          </p>
          <div className="mt-10 overflow-hidden outline outline-1 -outline-offset-1 outline-white/12">
            <Image
              src="/alumni/where-they-work.png"
              alt="Employers of MECG alumni, including Microsoft, Goldman Sachs, Meta, Tesla, Citadel, Deloitte, Capital One, IBM, JPMorgan Chase, BlackRock, BCG, Disney, United Airlines, Jane Street, EY, NASA, SpaceX, Ford, and others"
              width={1822}
              height={982}
              sizes="(min-width: 1024px) 72rem, 100vw"
              className="h-auto w-full bg-white"
            />
          </div>
          <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-white/55">
            Fig. 02 — Alumni placements
          </p>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 bg-mecg-navy px-8 py-14 text-white sm:px-12 sm:py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <SectionLabel number="00.7" className="text-mecg-orange">Next step</SectionLabel>
            <h2 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Bring a decision, or join the next cohort.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/60">
              Organizations start with a focused question. Students start with an application. Both reach the board within a week.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/work" className="button-primary">
              Discuss a project
            </Link>
            <Link href="/join" className="button-dark">
              Join MECG
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
