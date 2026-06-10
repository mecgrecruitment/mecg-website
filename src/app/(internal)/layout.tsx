import Link from "next/link";

export const dynamic = "force-dynamic";

const internalNav = [
  { href: "/internal", label: "Dashboard" },
  { href: "/internal/candidates", label: "Candidates" },
  { href: "/internal/score", label: "Scoring" },
  { href: "/internal/speed-dating", label: "Speed Dating" },
  { href: "/internal/events", label: "Events" },
  { href: "/internal/calendar", label: "Calendar" },
  { href: "/internal/hash", label: "Hash" },
  { href: "/internal/members", label: "Members" },
  { href: "/internal/admin", label: "Admin" },
  { href: "/internal/audit", label: "Audit" },
];

export default function InternalZoneLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-[var(--navy-950)] text-white">
      <div className="border-b border-white/10 bg-[rgba(8,18,37,0.88)] px-5 py-4 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <Link href="/internal">
            <p className="annotation text-white/38">MECG Internal</p>
            <h1 className="font-display mt-1 text-3xl font-bold uppercase tracking-[-0.06em] md:text-4xl">
              Command Portal
            </h1>
          </Link>

          <nav className="flex gap-2 overflow-x-auto pb-1 md:justify-end md:pb-0">
            {internalNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-white/58 transition hover:border-[var(--orange)] hover:bg-[var(--orange)] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <section className="relative px-5 py-8 md:px-8 md:py-10">
        <div className="relative mx-auto max-w-[1600px]">{children}</div>
      </section>
    </main>
  );
}
