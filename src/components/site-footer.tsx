import Image from "next/image";
import Link from "next/link";

const FOOTER_LINKS = [
  ["Client Services", "/work"],
  ["Our Team", "/team"],
  ["Join Our Team", "/join"],
  ["Contact Us", "/contact"],
] as const;

export default function SiteFooter() {
  return (
    <footer className="bg-public-deep px-6 text-white sm:px-10">
      <div className="mx-auto max-w-6xl pb-6 pt-12 sm:pt-16">
        <div className="grid gap-10 pb-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Link href="/home" aria-label="MECG home" className="inline-flex min-h-11 items-center">
              <Image src="/logos/mecg-white.svg" alt="MECG" width={168} height={44} className="h-10 w-auto" />
            </Link>
            <p className="mt-5 max-w-xs text-base leading-7 text-white/70">Pro bono consulting by University of Michigan students. Open to every major.</p>
          </div>
          <nav aria-label="Footer navigation" className="grid content-start text-sm">
            {FOOTER_LINKS.map(([label, href]) => (
              <Link key={href} href={href} className="flex min-h-11 items-center justify-between border-b border-white/15 text-white transition-colors duration-150 hover:text-mecg-orange">{label}<span aria-hidden="true">↗</span></Link>
            ))}
          </nav>
          <div className="text-sm">
            <p className="font-semibold">Start a conversation</p>
            <a href="mailto:mecg-board@umich.edu" className="mt-2 flex min-h-11 items-center break-all text-white hover:text-mecg-orange">mecg-board@umich.edu</a>
            <div className="mt-3 flex flex-wrap gap-x-6">
              <a href="https://www.instagram.com/mecgmichigan" target="_blank" rel="noreferrer" className="flex min-h-11 items-center text-white/70 hover:text-white">Instagram <span className="sr-only">opens in a new tab</span></a>
              <a href="https://www.linkedin.com/company/michigan-engineering-consulting-group" target="_blank" rel="noreferrer" className="flex min-h-11 items-center text-white/70 hover:text-white">LinkedIn <span className="sr-only">opens in a new tab</span></a>
            </div>
          </div>
        </div>
        <div className="grid border-y border-white/15 text-xs sm:grid-cols-[1.5fr_1fr_auto]">
          <p className="py-4 font-mono text-white/70">MICHIGAN ENGINEERING CONSULTING GROUP</p>
          <p className="border-t border-white/15 py-4 font-mono text-white/70 sm:border-l sm:border-t-0 sm:px-5">ANN ARBOR, MICHIGAN</p>
          <p className="border-t border-white/15 py-4 text-white/70 sm:border-l sm:border-t-0 sm:pl-5">© 2026 MECG</p>
        </div>
      </div>
    </footer>
  );
}
