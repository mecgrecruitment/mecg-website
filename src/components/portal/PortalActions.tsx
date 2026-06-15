import React from "react";
import Link from "next/link";

export function PortalActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href="/apply/create"
        className="rounded-full bg-[var(--orange)] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-white transition hover:bg-[var(--orange-soft)]"
      >
        Apply
      </Link>

      <Link
        href="/member-login"
        className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-white/72 transition hover:border-[var(--orange)] hover:text-white"
      >
        Member Login
      </Link>
    </div>
  );
}
