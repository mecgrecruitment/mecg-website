import type { Metadata } from "next";
import Image from "next/image";
import PageIntro from "@/components/page-intro";
import { BOARD } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Team",
  description: "Meet MECG's 2026 executive board and see what each leadership role owns.",
};

const ROLE_RESPONSIBILITIES: Record<string, string> = {
  President: "Organization direction and board coordination",
  "VP External": "Client and campus relationships",
  "VP Internal": "Member experience and internal operations",
  "VP Recruitment": "Rush planning and applicant communication",
  "VP Consulting": "Project teams and client delivery",
  "VP Education": "Member training and skill development",
  "VP Finance": "Budgeting and financial operations",
  "VP Marketing": "Brand, communications, and outreach",
};

export default function TeamPage() {
  return (
    <main className="bg-white text-mecg-navy">
      <PageIntro number="03" label="Executive board" title="The people responsible for the work." copy="The board runs client relationships, project teams, member education, recruitment, and the operations that keep MECG moving." />
      <section className="px-6 py-16 sm:py-20"><div className="mx-auto max-w-6xl"><div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">{BOARD.map(({name,role,src,linkedin})=><article key={name} className="group"><a href={linkedin} target="_blank" rel="noreferrer" aria-label={`${name} on LinkedIn`} className="block rounded-2xl"><div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-mecg-blue/10 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]"><Image src={src} alt={name} fill className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]" sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" /></div><p className="mt-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-mecg-orange">{role}</p><h2 className="mt-1 font-semibold sm:text-lg">{name}</h2><p className="mt-2 min-h-10 text-xs leading-5 text-mecg-navy/50">{ROLE_RESPONSIBILITIES[role]}</p><p className="mt-2 text-xs font-medium text-mecg-blue">LinkedIn ↗</p></a></article>)}</div></div></section>
    </main>
  );
}
