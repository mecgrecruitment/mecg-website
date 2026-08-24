import type { Metadata } from "next";
import Link from "next/link";
import PageIntro from "@/components/page-intro";
import SectionLabel from "@/components/section-label";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact MECG about a client project, student membership, or a general question.",
};

export default function ContactPage() {
  return (
    <main className="bg-white text-mecg-navy">
      <PageIntro number="05" label="Contact" title="Start with the right inbox." copy="Project questions, rush questions, and general notes all reach the MECG board. Tell us what you are working on and what kind of response would help." />
      <section className="px-6 py-16 sm:py-20"><div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2"><Link href="/work#project-inquiry" className="group bg-mecg-navy p-7 text-white sm:p-9"><p className="font-mono text-xs uppercase tracking-[0.18em] text-mecg-orange">For organizations</p><h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">Discuss a project <span className="inline-block transition-transform group-hover:translate-x-1">→</span></h2><p className="mt-4 max-w-lg leading-7 text-white/55">Include the decision you are facing, who will use the work, and any timing constraints. A rough problem is enough to begin.</p></Link><a href="mailto:mecg-board@umich.edu?subject=MECG%20rush%20question" className="group bg-mecg-blue/[0.12] p-7 outline outline-1 -outline-offset-1 outline-mecg-navy/10 sm:p-9"><p className="font-mono text-xs uppercase tracking-[0.18em] text-mecg-orange-ink">For students</p><h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">Ask about MECG <span className="inline-block transition-transform group-hover:translate-x-1">→</span></h2><p className="mt-4 max-w-lg leading-7 text-mecg-navy/60">Ask about rush, member experience, or whether MECG fits what you want to learn. You do not need to write a formal note.</p></a></div></section>
      <section className="bg-mecg-blue/[0.08] px-6 py-16 sm:py-20"><div className="mx-auto max-w-6xl"><SectionLabel number="05.1">What happens next</SectionLabel><div className="mt-8 grid gap-px overflow-hidden bg-mecg-navy/10 md:grid-cols-3">{[["01", "We read the context", "The board routes your note to the person responsible for projects, recruitment, or general operations."], ["02", "We clarify the question", "If more context would help, we will ask about the decision, timing, or people involved."], ["03", "We agree on a next step", "That may be a short conversation, application guidance, or an honest answer that MECG is not the right fit."]].map(([number, title, copy]) => <article key={number} className="bg-white p-6"><p className="font-mono text-xs text-mecg-orange-ink">{number}</p><h2 className="mt-5 text-xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-mecg-navy/60">{copy}</p></article>)}</div></div></section>
      <section className="border-t border-mecg-navy/10 px-6 py-12"><div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2"><div><p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/60">Email</p><a href="mailto:mecg-board@umich.edu" className="mt-4 block text-2xl font-semibold text-mecg-blue">mecg-board@umich.edu</a><div className="mt-5 flex gap-5 text-sm"><a href="https://www.instagram.com/mecgmichigan" target="_blank" rel="noreferrer">Instagram ↗</a><a href="https://www.linkedin.com/company/michigan-engineering-consulting-group" target="_blank" rel="noreferrer">LinkedIn ↗</a></div></div><address className="not-italic"><p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/60">Campus</p><p className="mt-4 leading-7 text-mecg-navy/60">College of Engineering<br />University of Michigan<br />1221 Beal Ave<br />Ann Arbor, MI 48109</p></address></div></section>
    </main>
  );
}
