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
    <Link
      href="/member-login"
      className="fixed right-4 top-4 z-[90] inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-[var(--navy-900)]/90 px-6 text-xs font-extrabold uppercase tracking-[0.16em] text-white shadow-xl shadow-black/25 backdrop-blur transition hover:border-[var(--orange)] hover:bg-[var(--orange)] md:right-8 md:top-8"
    >
      Member Login
    </Link>
  );
}
