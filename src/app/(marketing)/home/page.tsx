import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SectionLabel from "@/components/section-label";
import MiniSymbol from "@/components/mini-symbol";
import { MemberCollage, MemberFaces } from "@/components/member-collage";
import StatsBand from "@/components/stats-band";

export const metadata: Metadata = {
  title: "Michigan Engineering Consulting Group",
  description: "Pro-bono, student-led consulting at the University of Michigan.",
};

export default function HomePage() {
  return (
    <main className="bg-white text-mecg-navy">
      <div className="flex flex-col lg:min-h-[calc(100svh-4.5rem)]">
        <section className="relative flex-1 overflow-hidden border-b border-mecg-navy/10 px-6 py-14 sm:flex sm:items-center sm:py-16">
          <div className="hero-grid absolute inset-0 opacity-40" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-6xl">
            <SectionLabel number="00">Michigan Engineering Consulting Group</SectionLabel>
            <h1 className="mt-5 max-w-5xl text-balance text-5xl font-semibold leading-[0.95] tracking-[-0.055em] sm:text-7xl lg:text-[5.5rem]">
              Students solving real
              <span className="block">business challenges.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-mecg-navy/65 sm:text-xl">
              MECG brings University of Michigan students together to deliver
              thoughtful, data-driven work for organizations across the country.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/work" className="button-primary">Explore our work <span aria-hidden="true">→</span></Link>
              <Link href="/join" className="button-secondary">Join MECG <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

        <StatsBand />
      </div>

      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-9 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <SectionLabel number="01">Inside MECG</SectionLabel>
            <h2 className="mt-5 max-w-xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Real teams. Real deadlines.
            </h2>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-mecg-navy/60">
              Members learn consulting by working in small teams, meeting with
              clients, and turning open-ended questions into useful next steps.
            </p>
            <div className="mt-7 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
              {[
                ["01", "Client work", "A semester-long question with a real audience."],
                ["02", "Member education", "Practical sessions on research, analysis, and communication."],
                ["03", "Cross-campus teams", "Students from every major bring a different point of view."],
              ].map(([number, title, copy]) => (
                <div key={number} className="grid gap-2 py-5 sm:grid-cols-[2rem_8rem_1fr] sm:gap-4">
                  <span className="font-mono text-xs text-mecg-orange">{number}</span>
                  <span className="font-semibold">{title}</span>
                  <span className="text-sm leading-6 text-mecg-navy/55">{copy}</span>
                </div>
              ))}
            </div>
            <Link href="/work" className="mt-8 inline-flex min-h-11 items-center text-sm font-semibold text-mecg-blue hover:text-mecg-navy">
              How projects work <span aria-hidden="true">→</span>
            </Link>
          </div>
          <MemberCollage />
        </div>
      </section>

      <section className="overflow-hidden bg-mecg-navy px-6 py-16 text-white sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-9 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <SectionLabel number="02">Alumni</SectionLabel>
            <MiniSymbol name="orbit" className="mt-7 h-8 w-8 text-mecg-orange" />
            <h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              The work travels with them.
            </h2>
            <p className="mt-6 max-w-lg text-pretty text-lg leading-8 text-white/60">
              MECG alumni have taken their experience into engineering, finance,
              technology, healthcare, and consulting teams across the country.
            </p>
            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-white/45">
              <span className="flex items-center gap-2"><MiniSymbol name="axis" className="h-4 w-4 text-mecg-orange" /> Build</span>
              <span className="flex items-center gap-2"><MiniSymbol name="signal" className="h-4 w-4 text-mecg-orange" /> Analyze</span>
              <span className="flex items-center gap-2"><MiniSymbol name="spark" className="h-4 w-4 text-mecg-orange" /> Lead</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] bg-white shadow-[0_28px_90px_rgba(0,0,0,0.28)] outline outline-1 -outline-offset-1 outline-white/10">
            <Image
              src="/alumni/IMG_6740.jpeg"
              alt="Employers of MECG alumni, including Microsoft, Goldman Sachs, Meta, Tesla, Citadel, Deloitte, Capital One, IBM, JPMorgan Chase, BlackRock, BCG, Disney, United Airlines, Jane Street, EY, NASA, SpaceX, Ford, and others"
              width={1672}
              height={941}
              sizes="(min-width: 1024px) 64vw, 100vw"
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-mecg-navy/10 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionLabel number="03">Choose your path</SectionLabel>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <Link href="/contact" className="group relative overflow-hidden rounded-[2rem] bg-mecg-navy p-7 text-white sm:p-9">
              <MiniSymbol name="axis" className="absolute bottom-9 right-9 h-20 w-20 text-mecg-blue/35" />
              <div className="relative z-10"><p className="font-mono text-xs uppercase tracking-[0.18em] text-mecg-orange">For organizations</p>
              <h2 className="mt-6 max-w-md text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Bring us a decision worth working through.</h2>
              <p className="mt-6 text-sm font-semibold text-mecg-blue">Discuss a project <span className="inline-block transition-transform group-hover:translate-x-1">→</span></p></div>
            </Link>
            <Link href="/join" className="group rounded-[2rem] bg-mecg-blue/[0.12] p-7 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.07)] sm:p-9">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-mecg-orange">For students</p>
              <h2 className="mt-6 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Learn the work by joining the team.</h2>
              <p className="mt-6 text-sm font-semibold text-mecg-blue">Learn about membership <span className="inline-block transition-transform group-hover:translate-x-1">→</span></p>
              <div className="mt-7 flex items-center gap-4 border-t border-mecg-navy/10 pt-5">
                <MemberFaces />
                <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-mecg-navy/45">70+ members</span>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
