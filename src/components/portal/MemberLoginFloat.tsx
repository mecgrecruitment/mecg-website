"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MemberLoginFloat() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/internal") ||
    pathname.startsWith("/member-login") ||
    pathname.startsWith("/apply") ||
    pathname.startsWith("/auth")
  ) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-[90] flex items-center gap-3 md:right-8 md:top-8">
      <Link
        href="/apply"
        className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--orange)] px-6 text-xs font-extrabold uppercase tracking-[0.16em] text-white shadow-xl shadow-black/25 transition hover:bg-[var(--orange-soft)]"
      >
        Apply
      </Link>

      <Link
        href="/member-login"
        className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-[var(--navy-900)]/90 px-6 text-xs font-extrabold uppercase tracking-[0.16em] text-white shadow-xl shadow-black/25 backdrop-blur transition hover:border-[var(--orange)] hover:bg-[var(--orange)]"
      >
        Member Login
      </Link>
    </div>
  );
}
