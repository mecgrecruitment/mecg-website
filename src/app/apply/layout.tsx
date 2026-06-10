import Link from "next/link";

const applicantNav = [
  { href: "/apply", label: "Login" },
  { href: "/apply/dashboard", label: "Dashboard" },
  { href: "/apply/application", label: "Application" },
  { href: "/apply/checkin", label: "Attendance" },
];

export default function ApplicantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--navy-950)] text-white">
      <header className="border-b border-white/10 bg-[rgba(8,18,37,0.92)] px-5 py-4 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link href="/apply">
            <p className="annotation text-white/38">MECG Applicants</p>
            <h1 className="font-display mt-1 text-3xl font-bold uppercase tracking-[-0.06em]">
              Applicant Portal
            </h1>
          </Link>

          <nav className="flex gap-2 overflow-x-auto">
            <Link
              href="/"
              className="shrink-0 rounded-full border border-[var(--orange)]/40 bg-[var(--orange)]/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--orange-soft)] transition hover:bg-[var(--orange)] hover:text-white"
            >
              Main Website
            </Link>
            {applicantNav.map((item) => (
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
      </header>

      <section className="px-5 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </section>
    </main>
  );
}
