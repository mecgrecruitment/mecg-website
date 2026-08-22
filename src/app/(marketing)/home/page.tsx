import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  FEATURED_ENGAGEMENT,
  HOMEPAGE_LEADERS,
  PAST_PROJECTS,
  SEMESTER_FACTS,
} from "@/lib/site-content";

const FEATURED_PORTRAITS = [
  { name: "Annie Callam", src: "/board/annie.jpeg" },
  { name: "Nandini Tatiwala", src: "/board/nandini.jpeg" },
  { name: "Abby Osterhart", src: "/board/abby.jpeg" },
  { name: "Jandy Arias", src: "/board/jandy.jpeg" },
] as const;

export const metadata: Metadata = {
  title: "Michigan Engineering Consulting Group",
  description: "Pro-bono, student-led consulting at the University of Michigan.",
};

export default function HomePage() {
  return (
    <main className="bg-white text-mecg-navy">
      <section className="bg-mecg-navy text-white">
        <div className="mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h1 className="max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">
              Student consulting at Michigan.
            </h1>
            <p className="mt-4 text-base text-white/60">Pro bono. One semester.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/work" className="button-editorial">
                Discuss a project
              </Link>
              <Link href="/join" className="text-sm font-medium text-white/80 underline-offset-4 hover:underline">
                Join
              </Link>
            </div>
          </div>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden">
            <Image
              src="/board/luciano.jpeg"
              alt="Luciano del Carpio, VP Education"
              fill
              priority
              sizes="(min-width: 1024px) 28rem, 90vw"
              className="object-cover object-[center_18%]"
            />
          </div>
        </div>
      </section>

      <section className="paper-band border-b border-mecg-navy/10 px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-mecg-navy/45">
            Selected organizations
          </p>
          <ul className="mt-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-10 sm:gap-y-3">
            {PAST_PROJECTS.map((project) => (
              <li key={project.name}>
                <a
                  href={project.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-2xl text-mecg-navy hover:text-mecg-blue sm:text-3xl"
                >
                  {project.name}
                </a>
                <span className="ml-3 text-sm text-mecg-navy/45">{project.industry}</span>
              </li>
            ))}
            <li className="text-sm text-mecg-navy/45">and 30+ others</li>
          </ul>
        </div>
      </section>

      <section className="border-b border-mecg-navy/10 px-6 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-mecg-orange">
              {FEATURED_ENGAGEMENT.industry}
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {FEATURED_ENGAGEMENT.client}
            </h2>
            <p className="mt-3 text-sm text-mecg-navy/45">{FEATURED_ENGAGEMENT.location}</p>
            <p className="mt-8 text-2xl leading-snug text-mecg-navy/85">
              {FEATURED_ENGAGEMENT.question}
            </p>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-mecg-navy/60">
              {FEATURED_ENGAGEMENT.body}
            </p>
            <Link href={FEATURED_ENGAGEMENT.href} className="mt-8 inline-flex text-sm font-semibold text-mecg-blue hover:text-mecg-navy">
              See how an engagement works
            </Link>
            <div className="mt-10 border-t border-mecg-navy/10 pt-6">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-mecg-navy/40">Also</p>
              <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {PAST_PROJECTS.filter((project) => project.name !== FEATURED_ENGAGEMENT.client).map((project) => (
                  <a key={project.name} href={project.website} target="_blank" rel="noreferrer" className="text-mecg-navy/70 hover:text-mecg-blue">
                    {project.name}
                  </a>
                ))}
              </p>
            </div>
          </div>
          <div className="grid min-h-80 grid-cols-2 gap-px overflow-hidden bg-mecg-navy/10 outline outline-1 -outline-offset-1 outline-mecg-navy/10 lg:min-h-[28rem]">
            {FEATURED_PORTRAITS.map((person) => (
              <div key={person.src} className="relative min-h-40 bg-mecg-navy/5">
                <Image
                  src={person.src}
                  alt={person.name}
                  fill
                  sizes="(min-width: 1024px) 20vw, 50vw"
                  className="object-cover object-top"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-mecg-navy/10 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            How a semester is structured
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-mecg-navy/60">
            A team of Michigan students works a single question for the term,
            then hands off a recommendation the client can keep.
          </p>
          <dl className="mt-12 grid gap-px bg-mecg-navy/10 sm:grid-cols-2 lg:grid-cols-4">
            {SEMESTER_FACTS.map(([term, value]) => (
              <div key={term} className="bg-white px-6 py-7">
                <dt className="text-[0.7rem] uppercase tracking-[0.18em] text-mecg-navy/40">{term}</dt>
                <dd className="mt-3 text-2xl">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-mecg-navy/10 px-6 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              The people who do the work
            </h2>
            <p className="mt-6 max-w-md text-lg leading-8 text-mecg-navy/60">
              Members come from across the University of Michigan. Client work
              is led by students who also run the organization.
            </p>
            <ul className="mt-8 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
              {HOMEPAGE_LEADERS.map((person) => (
                <li key={person.name} className="flex items-center justify-between gap-4 py-4">
                  <span className="font-medium">{person.name}</span>
                  <span className="text-sm text-mecg-navy/45">{person.role}</span>
                </li>
              ))}
            </ul>
            <Link href="/team" className="mt-6 inline-flex text-sm font-semibold text-mecg-blue hover:text-mecg-navy">
              Meet the board
            </Link>
          </div>
          <div className="relative min-h-[22rem] overflow-hidden outline outline-1 -outline-offset-1 outline-mecg-navy/10 sm:min-h-[28rem]">
            <Image
              src="/mecg/members-outdoors.jpg"
              alt="MECG members at an outdoor Michigan event"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-mecg-navy px-6 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Where the work goes next
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-8 text-white/60">
            Alumni have taken MECG experience into engineering, finance,
            technology, and consulting teams.
          </p>
          <div className="mt-10 overflow-hidden outline outline-1 -outline-offset-1 outline-white/10">
            <Image
              src="/alumni/IMG_6740.jpeg"
              alt="Employers of MECG alumni, including Microsoft, Goldman Sachs, Meta, Tesla, Citadel, Deloitte, Capital One, IBM, JPMorgan Chase, BlackRock, BCG, Disney, United Airlines, Jane Street, EY, NASA, SpaceX, Ford, and others"
              width={1672}
              height={941}
              sizes="(min-width: 1024px) 72rem, 100vw"
              className="h-auto w-full bg-white"
            />
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl bg-mecg-navy px-8 py-14 text-white sm:px-12 sm:py-16">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-mecg-orange">For organizations</p>
          <h2 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Bring a decision that can wait a semester, but not forever.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/60">
            If you have a focused question, a contact who can stay involved, and
            information the team can actually use, we should talk.
          </p>
          <Link href="/contact" className="button-editorial mt-8">
            Start a conversation
          </Link>
        </div>
      </section>
    </main>
  );
}
