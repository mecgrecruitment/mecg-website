import type { Metadata } from "next";
import Link from "next/link";
import PageIntro from "@/components/page-intro";
import SectionLabel from "@/components/section-label";

export const metadata: Metadata = {
  title: "Join MECG",
  description: "Learn what MECG membership involves, who can apply, and how the application process works.",
};

const REASONS = [
  ["Work on a real question", "Members learn through a semester-long client project. The work has a deadline, an audience, and consequences outside a classroom."],
  ["Get better at the basics", "Education sessions cover research, analysis, structured thinking, and communication. Project teams give you somewhere to use them."],
  ["Know people outside your major", "MECG is open to every major. Teams work better when technical, business, design, and social perspectives share the table."],
];

const EXPECTATIONS = [
  ["Show up prepared", "Client work depends on teammates meeting deadlines and bringing usable work to each meeting."],
  ["Ask better questions", "Members are expected to surface uncertainty, listen carefully, and revise their first answer."],
  ["Share the work", "Project teams divide research, analysis, client communication, and final delivery across the group."],
] as const;

const RECRUITMENT_STEPS = [
  ["01", "Apply", "Share what you want to learn and the experiences that shaped how you work."],
  ["02", "Meet the group", "Rush events introduce the organization, its people, and the kind of work members do."],
  ["03", "Work through a case", "The process looks at how you listen, structure a problem, collaborate, and respond to new information."],
  ["04", "Check your status", "Your private applicant link keeps event check-ins and the final decision in one place."],
] as const;

const MEMBER_FAQS = [
  ["Who can apply?", "Current University of Michigan students from any school, college, or major can apply."],
  ["Do I need consulting experience?", "No. MECG teaches the core skills and looks for curiosity, reliability, and a willingness to learn."],
  ["What is the weekly commitment?", "Membership includes project work, team meetings, and organization events. Exact schedules depend on the semester and project, so ask during rush before committing."],
  ["When does recruitment happen?", "Recruitment runs by semester. Use the application page and MECG social channels for the current cycle's dates and updates."],
] as const;

export default function JoinPage() {
  return (
    <main className="bg-white text-mecg-navy">
      <PageIntro number="04" label="Prospective members" title="You can learn this work." copy="You do not need consulting experience or a specific major. MECG looks for people who are curious, dependable, and willing to improve in public." />
      <section className="px-6 py-16 sm:py-20"><div className="mx-auto max-w-6xl"><SectionLabel number="04.1">Why join</SectionLabel><div className="mt-7 grid gap-5 lg:grid-cols-3">{REASONS.map(([title,copy],index)=><article key={title} className="rounded-2xl bg-mecg-blue/[0.1] p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.06)]"><p className="font-mono text-xs text-mecg-orange">0{index+1}</p><h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">{title}</h2><p className="mt-3 leading-7 text-mecg-navy/60">{copy}</p></article>)}</div></div></section>
      <section className="bg-mecg-blue/[0.08] px-6 py-16 sm:py-20"><div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.7fr_1.3fr]"><div><SectionLabel number="04.2">What membership asks</SectionLabel><h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.04em]">Be someone your team can count on.</h2></div><div className="divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">{EXPECTATIONS.map(([title, copy], index) => <div key={title} className="grid gap-2 py-5 sm:grid-cols-[2.5rem_10rem_1fr]"><span className="font-mono text-xs text-mecg-orange">0{index + 1}</span><h3 className="font-semibold">{title}</h3><p className="leading-7 text-mecg-navy/60">{copy}</p></div>)}</div></div></section>
      <section className="px-6 py-16 sm:py-20"><div className="mx-auto max-w-6xl"><SectionLabel number="04.3">Recruitment process</SectionLabel><h2 className="mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Know what comes next.</h2><div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-mecg-navy/10 sm:grid-cols-2 lg:grid-cols-4">{RECRUITMENT_STEPS.map(([number, title, copy]) => <article key={number} className="bg-white p-6"><p className="font-mono text-xs text-mecg-orange">{number}</p><h3 className="mt-5 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-mecg-navy/60">{copy}</p></article>)}</div></div></section>
      <section className="bg-mecg-blue/[0.08] px-6 py-16 sm:py-20"><div className="mx-auto grid max-w-6xl gap-9 lg:grid-cols-[0.72fr_1.28fr]"><div><SectionLabel number="04.4">Questions</SectionLabel><h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.04em]">The things applicants ask first.</h2></div><div className="divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">{MEMBER_FAQS.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-semibold"><span>{question}</span><span className="text-mecg-orange transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary><p className="mt-3 max-w-2xl pr-8 leading-7 text-mecg-navy/60">{answer}</p></details>)}</div></div></section>
      <section className="bg-mecg-navy px-6 py-16 text-white sm:py-20"><div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><SectionLabel number="04.5">Apply</SectionLabel><h2 className="mt-5 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">One application. One private status link.</h2><p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-white/60">Students from every major can apply. Submit your contact information once, then use the private link to follow rush check-ins and your application status.</p></div><div className="flex flex-wrap gap-3"><Link href="/apply" className="button-primary">Apply now →</Link><a href="mailto:mecg-board@umich.edu?subject=MECG%20rush%20question" className="button-dark">Ask about rush ↗</a></div></div></section>
    </main>
  );
}
