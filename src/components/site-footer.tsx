import Image from "next/image";
import Link from "next/link";

const FOOTER_LINKS = [
  ["Our Team", "/team"],
  ["Client Services", "/work"],
  ["Join Our Team", "/join"],
  ["Contact Us", "/contact"],
] as const;

export default function SiteFooter() {
  return (
    <footer className="bg-mecg-navy px-6 py-8 text-white sm:px-10 sm:py-10">
      <div className="mx-auto grid max-w-6xl gap-6 border-b border-white/15 pb-6 md:grid-cols-[1.3fr_0.7fr_0.7fr] md:gap-8 md:pb-8">
        <div>
          <Link href="/home" aria-label="MECG home" className="inline-flex min-h-11 items-center">
            <Image src="/logos/mecg-white.svg" alt="MECG" width={168} height={44} className="h-10 w-auto" style={{ width: "auto" }} />
          </Link>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/65">
            Pro-bono consulting group open to all majors at the University of Michigan.
          </p>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-col items-start gap-2 text-sm">
          {FOOTER_LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="flex min-h-10 items-center text-white/75 transition-colors duration-150 hover:text-white">{label}</Link>
          ))}
        </nav>

        <div className="flex flex-col items-start gap-2 text-sm">
          <a href="mailto:mecg-board@umich.edu" className="flex min-h-10 items-center text-white/75 transition-colors duration-150 hover:text-white">mecg-board@umich.edu</a>
          <a href="https://www.instagram.com/mecgmichigan" target="_blank" rel="noreferrer" className="flex min-h-10 items-center text-white/75 transition-colors duration-150 hover:text-white">Instagram <span className="sr-only">opens in a new tab</span></a>
          <a href="https://www.linkedin.com/company/michigan-engineering-consulting-group" target="_blank" rel="noreferrer" className="flex min-h-10 items-center text-white/75 transition-colors duration-150 hover:text-white">LinkedIn <span className="sr-only">opens in a new tab</span></a>
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-6xl text-xs text-white/50">© 2026 Michigan Engineering Consulting Group</p>
    </footer>
  );
}
