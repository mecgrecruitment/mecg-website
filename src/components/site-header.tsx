"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/work", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/team", label: "Team" },
  { href: "/join", label: "Join" },
  { href: "/contact", label: "Contact" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-mecg-navy/95 text-white backdrop-blur">
      <div className="mx-auto flex min-h-18 max-w-6xl items-center justify-between px-6">
        <Link href="/home" className="rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mecg-orange" aria-label="MECG home">
          <Image src="/logos/mecg-white.svg" alt="MECG" width={140} height={36} priority className="h-8 w-auto" style={{ width: "auto" }} />
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm md:flex">
          {NAV_LINKS.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`border-b py-1 transition-colors ${pathname === href ? "border-mecg-orange text-white" : "border-transparent text-white/60 hover:text-white"}`}>{label}</Link>)}
          <Link href="/apply" className="rounded-full bg-mecg-orange px-5 py-2.5 font-medium text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.96]">Apply</Link>
        </nav>
        <button type="button" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((value) => !value)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 text-sm md:hidden">{open ? "Close" : "Menu"}</button>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label="Mobile navigation" className="border-t border-white/10 px-6 py-5 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col">
            {NAV_LINKS.map(({ href, label }) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={pathname === href ? "page" : undefined} className={`border-b border-white/10 py-4 text-lg ${pathname === href ? "text-mecg-orange" : "text-white"}`}>{label}</Link>)}
            <Link href="/apply" className="mt-5 rounded-full bg-mecg-orange px-5 py-3 text-center font-medium text-white">Apply</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
