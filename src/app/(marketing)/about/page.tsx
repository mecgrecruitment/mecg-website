import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PageIntro from "@/components/page-intro";
import SectionLabel from "@/components/section-label";

export const metadata: Metadata = {
  title: "About",
  description: "Read how MECG began at Michigan and the principles that guide the organization.",
};

const PRINCIPLES = [
  ["Define before solving", "A useful project starts with a precise question, a real decision, and a clear audience."],
  ["Test the assumption", "Teams look for evidence that challenges the first answer instead of defending it."],
  ["Explain the reasoning", "Recommendations include their evidence and limits so another person can use the work."],
] as const;

export default function AboutPage() {
  return (
    <main className="bg-white text-mecg-navy">
      <PageIntro
        number="02"
        label="About MECG"
        title="Engineering habits, applied to business questions."
        copy="MECG is a pro-bono consulting group at the University of Michigan. Students from every major are welcome. Our engineering roots show up in how we define problems, test assumptions, and explain the work."
      />
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-9 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionLabel number="02.1">President&apos;s note</SectionLabel>
            <h2 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Learn consulting by doing it.</h2>
            <div className="mt-6 space-y-4 text-pretty text-lg leading-8 text-mecg-navy/60">
              <p>MECG gives students a place to work on real client questions while learning how to listen, analyze, and communicate across disciplines.</p>
              <p>Project work sits beside education, mentorship, and professional development. You do not need a particular major or prior consulting experience to contribute. Curiosity and follow-through matter more.</p>
            </div>
            <p className="mt-6 font-semibold">Annie Callam</p>
            <p className="mt-1 text-sm text-mecg-navy/60">President of MECG, 2026</p>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden bg-mecg-navy outline outline-1 -outline-offset-1 outline-mecg-navy/10">
            <Image src="/about/president.jpg" alt="Annie Callam, President of MECG" fill className="object-cover object-center" sizes="(min-width: 1024px) 50vw, 100vw" />
          </div>
        </div>
      </section>
      <section className="bg-mecg-blue/[0.08] px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          <div>
            <SectionLabel number="02.2">Our history</SectionLabel>
            <h2 className="mt-5 text-4xl font-semibold tracking-tight">Built at Michigan.</h2>
          </div>
          <div className="space-y-4 text-pretty text-lg leading-8 text-mecg-navy/60">
            <p>Jonathan Fay and Aaryan Singh founded MECG in 2023 to give students across the University of Michigan a place to practice consulting while growing professionally and personally.</p>
            <p>The first member cohort began in Winter 2024. Since then, MECG has grown to more than 70 members and partnered with more than 30 organizations.</p>
            <Link href="/team" className="inline-block pt-2 text-sm font-semibold text-mecg-blue">Meet the current board →</Link>
          </div>
        </div>
      </section>
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionLabel number="02.3">How we think</SectionLabel>
          <h2 className="mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">The engineering part is a way of working.</h2>
          <div className="mt-8 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
            {PRINCIPLES.map(([title, copy], index) => (
              <div key={title} className="grid gap-3 py-5 sm:grid-cols-[3rem_13rem_1fr]">
                <span className="font-mono text-xs text-mecg-orange-ink">0{index + 1}</span>
                <h3 className="font-semibold">{title}</h3>
                <p className="max-w-2xl leading-7 text-mecg-navy/60">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
