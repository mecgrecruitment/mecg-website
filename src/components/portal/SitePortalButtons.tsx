"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SitePortalButtons() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/internal") ||
    pathname.startsWith("/member-login") ||
    pathname.startsWith("/apply/create") ||
    pathname.startsWith("/apply/dashboard") ||
    pathname.startsWith("/auth")
  ) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-[80] flex gap-2 md:right-6 md:top-6">
      <Link
        href="/apply/create"
        className="rounded-full bg-[var(--orange)] px-4 py-2 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-white shadow-lg shadow-black/20 transition hover:bg-[var(--orange-soft)]"
      >
        Apply
      </Link>

      <Link
        href="/member-login"
        className="rounded-full border border-white/15 bg-[var(--navy-900)]/80 px-4 py-2 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-white/80 shadow-lg shadow-black/20 backdrop-blur transition hover:border-[var(--orange)] hover:text-white"
      >
        Member Login
      </Link>
    </div>
  );
}
