import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type MemberRole } from "@/lib/auth";

// §9.0.1: navigation respects role. General members get the open-rush roster
// and their own profile; committee adds candidates/scoring/hash; board adds
// admin and audit. The nav is convenience — every gated page re-checks its
// role server-side and RLS is the real boundary (SEC-16).
const links: { label: string; href: string; roles?: MemberRole[] }[] = [
  { label: "Dashboard", href: "/internal" },
  { label: "Candidates", href: "/internal/candidates" },
  {
    label: "Hash",
    href: "/internal/hash",
    roles: ["board", "recruitment_committee"],
  },
  { label: "Calendar", href: "/internal/calendar" },
  { label: "Members", href: "/internal/members" },
  { label: "Admin", href: "/internal/admin", roles: ["board"] },
  { label: "Audit", href: "/internal/audit", roles: ["board"] },
];

export default async function InternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?message=Member login required.");
  }

  // Authoritative gate: a live members row (RLS always allows reading your own).
  // Applicants are not members — they get bounced to the applicant dashboard.
  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, email, role")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!member) {
    redirect("/apply/dashboard");
  }

  const visibleLinks = links.filter(
    (link) => !link.roles || link.roles.includes(member.role)
  );

  return (
    <main className="min-h-screen bg-[var(--navy-950)] text-white">
      <div className="border-b border-white/10 bg-[var(--navy-900)] px-5 py-4 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[var(--orange)]">
              MECG Internal
            </p>
            <h1 className="font-display mt-1 text-2xl font-bold uppercase tracking-[-0.04em]">
              Member Portal
            </h1>
            <p className="mt-1 text-xs text-white/40">
              {member.full_name ?? member.email} · {ROLE_LABELS[member.role]}
            </p>
          </div>

          <nav className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/56">
            {visibleLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full border border-white/10 px-4 py-2 transition hover:border-[var(--orange)] hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <a
              href="/auth/logout"
              className="rounded-full border border-white/10 px-4 py-2 transition hover:border-red-400 hover:text-white"
            >
              Logout
            </a>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">{children}</div>
    </main>
  );
}
