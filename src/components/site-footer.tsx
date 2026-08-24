import Image from "next/image";
import Link from "next/link";

function CellLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-xs uppercase tracking-[0.16em] text-white/55">{children}</p>;
}

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/12 bg-mecg-navy px-6 py-10 text-white">
      <div className="mx-auto grid max-w-6xl gap-px border border-white/12 bg-white/12 md:grid-cols-[1.2fr_0.8fr_1fr]">
        <div className="bg-mecg-navy p-6">
          <CellLabel>Org / Michigan Engineering Consulting Group</CellLabel>
          <Image src="/logos/mecg-white.svg" alt="MECG" width={168} height={44} className="mt-5 h-9 w-auto" style={{ width: "auto" }} />
          <p className="mt-5 max-w-sm text-sm leading-6 text-white/55">Pro-bono, student-led consulting at the University of Michigan.</p>
        </div>
        <nav aria-label="Footer" className="bg-mecg-navy p-6">
          <CellLabel>Explore</CellLabel>
          <div className="mt-4 grid gap-3 text-sm text-white/80">
            <Link href="/work" className="hover:text-white">Work</Link>
            <Link href="/about" className="hover:text-white">About</Link>
            <Link href="/team" className="hover:text-white">Team</Link>
            <Link href="/join" className="hover:text-white">Join</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
            <Link href="/apply" className="hover:text-white">Apply</Link>
          </div>
        </nav>
        <address className="grid gap-px bg-white/12 not-italic">
          <div className="bg-mecg-navy p-6">
            <CellLabel>Contact</CellLabel>
            <a href="mailto:mecg-board@umich.edu" className="mt-4 block text-sm font-medium hover:text-mecg-orange">mecg-board@umich.edu</a>
            <div className="mt-4 flex gap-4 text-sm">
              <a href="https://www.instagram.com/mecgmichigan" target="_blank" rel="noreferrer">Instagram ↗<span className="sr-only"> (opens in a new tab)</span></a>
              <a href="https://www.linkedin.com/company/michigan-engineering-consulting-group" target="_blank" rel="noreferrer">LinkedIn ↗<span className="sr-only"> (opens in a new tab)</span></a>
            </div>
          </div>
          <div className="bg-mecg-navy p-6">
            <CellLabel>Loc / Ann Arbor MI</CellLabel>
            <p className="mt-4 text-sm leading-6 text-white/55">College of Engineering<br />University of Michigan<br />1221 Beal Ave<br />Ann Arbor, MI 48109</p>
          </div>
        </address>
      </div>
      <div className="mx-auto mt-8 flex max-w-6xl flex-col gap-2 border-t border-white/12 pt-5 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-white/55 sm:flex-row sm:justify-between">
        <p>© 2026 Michigan Engineering Consulting Group</p><p>Founded in Ann Arbor / 2023</p><p>Rev / 2026.A</p>
      </div>
    </footer>
  );
}
