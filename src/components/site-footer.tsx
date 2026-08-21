import Image from "next/image";
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-mecg-navy px-6 py-10 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.2fr_0.8fr_1fr]">
        <div>
          <Image src="/logos/mecg-white.svg" alt="MECG" width={120} height={36} />
          <p className="mt-5 max-w-sm text-sm leading-6 text-white/55">Michigan Engineering Consulting Group. Pro-bono, student-led consulting at the University of Michigan.</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-white/40">Explore</p>
          <div className="mt-4 grid gap-3 text-sm">
            <Link href="/work">Work</Link><Link href="/about">About</Link><Link href="/team">Team</Link><Link href="/join">Join</Link><Link href="/contact">Contact</Link><Link href="/apply">Apply</Link>
          </div>
        </div>
        <address className="not-italic">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-white/40">Contact</p>
          <a href="mailto:mecg-board@umich.edu" className="mt-4 block text-sm font-medium hover:text-mecg-orange">mecg-board@umich.edu</a>
          <p className="mt-3 text-sm leading-6 text-white/55">College of Engineering<br />University of Michigan<br />1221 Beal Ave<br />Ann Arbor, MI 48109</p>
          <div className="mt-5 flex gap-4 text-sm">
            <a href="https://www.instagram.com/mecgmichigan" target="_blank" rel="noreferrer">Instagram ↗</a>
            <a href="https://www.linkedin.com/company/michigan-engineering-consulting-group" target="_blank" rel="noreferrer">LinkedIn ↗</a>
          </div>
        </address>
      </div>
      <div className="mx-auto mt-8 flex max-w-6xl flex-col gap-2 border-t border-white/10 pt-5 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-white/40 sm:flex-row sm:justify-between">
        <p>© 2026 Michigan Engineering Consulting Group</p><p>Founded in Ann Arbor / 2023</p>
      </div>
    </footer>
  );
}
