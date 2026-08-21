import type { Metadata } from "next";
import PageIntro from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact MECG about a client project, student membership, or a general question.",
};

export default function ContactPage() {
  return (
    <main className="bg-white text-mecg-navy">
      <PageIntro number="05" label="Contact" title="Start with the right inbox." copy="Project questions, rush questions, and general notes all reach the MECG board. Tell us what you are working on and what kind of response would help." />
      <section className="px-6 py-16 sm:py-20"><div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2"><a href="mailto:mecg-board@umich.edu?subject=Project%20inquiry" className="group rounded-[2rem] bg-mecg-navy p-7 text-white sm:p-9"><p className="font-mono text-xs uppercase tracking-[0.18em] text-mecg-orange">For organizations</p><h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Discuss a project <span className="inline-block transition-transform group-hover:translate-x-1">→</span></h2><p className="mt-4 max-w-lg leading-7 text-white/55">Include the decision you are facing, who will use the work, and any timing constraints. A rough problem is enough to begin.</p></a><a href="mailto:mecg-board@umich.edu?subject=MECG%20rush%20question" className="group rounded-[2rem] bg-mecg-blue/[0.12] p-7 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.07)] sm:p-9"><p className="font-mono text-xs uppercase tracking-[0.18em] text-mecg-orange">For students</p><h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Ask about MECG <span className="inline-block transition-transform group-hover:translate-x-1">→</span></h2><p className="mt-4 max-w-lg leading-7 text-mecg-navy/60">Ask about rush, member experience, or whether MECG fits what you want to learn. You do not need to write a formal note.</p></a></div></section>
      <section className="border-t border-mecg-navy/10 px-6 py-12"><div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2"><div><p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/40">Email</p><a href="mailto:mecg-board@umich.edu" className="mt-4 block text-2xl font-semibold text-mecg-blue">mecg-board@umich.edu</a><div className="mt-5 flex gap-5 text-sm"><a href="https://www.instagram.com/mecgmichigan" target="_blank" rel="noreferrer">Instagram ↗</a><a href="https://www.linkedin.com/company/michigan-engineering-consulting-group" target="_blank" rel="noreferrer">LinkedIn ↗</a></div></div><address className="not-italic"><p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/40">Campus</p><p className="mt-4 leading-7 text-mecg-navy/60">College of Engineering<br />University of Michigan<br />1221 Beal Ave<br />Ann Arbor, MI 48109</p></address></div></section>
    </main>
  );
}
