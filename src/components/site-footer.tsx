import Image from "next/image";
import Link from "next/link";

function CellLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-xs uppercase tracking-[0.16em] text-white/55">{children}</p>;
}

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/12 bg-mecg-navy px-6 py-8 text-white sm:px-10">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px border border-white/12 bg-white/12 md:grid-cols-[1.2fr_0.8fr_1fr]">
        <div className="col-span-2 bg-mecg-navy p-5 sm:p-6 md:col-span-1">
          <CellLabel>Org / Michigan Engineering Consulting Group</CellLabel>
          <Image src="/logos/mecg-white.svg" alt="MECG" width={168} height={44} className="mt-5 h-9 w-auto" style={{ width: "auto" }} />
          <p className="mt-5 max-w-sm text-sm leading-6 text-white/55">Pro-bono, student-led consulting at the University of Michigan.</p>
        </div>
        <nav aria-label="Footer" className="bg-mecg-navy p-5 sm:p-6">
          <CellLabel>Explore</CellLabel>
          <div className="mt-3 grid grid-cols-2 text-sm text-white/80 md:grid-cols-1">
            <Link href="/work" className="flex min-h-11 items-center hover:text-white md:min-h-9">Work</Link>
            <Link href="/about" className="flex min-h-11 items-center hover:text-white md:min-h-9">About</Link>
            <Link href="/team" className="flex min-h-11 items-center hover:text-white md:min-h-9">Team</Link>
            <Link href="/join" className="flex min-h-11 items-center hover:text-white md:min-h-9">Join</Link>
            <Link href="/contact" className="flex min-h-11 items-center hover:text-white md:min-h-9">Contact</Link>
            <Link href="/apply" className="flex min-h-11 items-center hover:text-white md:min-h-9">Apply</Link>
          </div>
        </nav>
        <address className="grid gap-px bg-white/12 not-italic">
          <div className="bg-mecg-navy p-4 sm:p-6">
            <CellLabel>Contact</CellLabel>
            <a href="mailto:mecg-board@umich.edu" className="mt-2 flex min-h-11 items-center text-sm font-medium hover:text-mecg-orange sm:mt-4 md:min-h-0">mecg-board@umich.edu</a>
            <div className="mt-1 flex flex-wrap gap-x-4 text-sm sm:mt-4">
              <a href="https://www.instagram.com/mecgmichigan" target="_blank" rel="noreferrer" className="flex min-h-11 items-center md:min-h-0">Instagram ↗<span className="sr-only"> (opens in a new tab)</span></a>
              <a href="https://www.linkedin.com/company/michigan-engineering-consulting-group" target="_blank" rel="noreferrer" className="flex min-h-11 items-center md:min-h-0">LinkedIn ↗<span className="sr-only"> (opens in a new tab)</span></a>
            </div>
          </div>
          <div className="bg-mecg-navy p-4 sm:p-6">
            <CellLabel>Loc / Ann Arbor MI</CellLabel>
            <p className="mt-3 text-sm leading-5 text-white/55 sm:mt-4 sm:leading-6">College of Engineering<br />University of Michigan<br />1221 Beal Ave<br />Ann Arbor, MI 48109</p>
          </div>
        </address>
      </div>
      <div className="mx-auto mt-6 flex max-w-6xl flex-col gap-2 border-t border-white/12 pt-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-white/55 sm:flex-row sm:justify-between">
        <p>© 2026 Michigan Engineering Consulting Group</p><p>Founded in Ann Arbor / 2023</p><p>Rev / 2026.A</p>
      </div>
    </footer>
  );
}
