import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

const links = [
  { label: "Dashboard", href: "/internal" },
  { label: "Candidates", href: "/internal/candidates" },
  { label: "Scoring", href: "/internal/scoring" },
  { label: "Calendar", href: "/internal/calendar" },
  { label: "Members", href: "/internal/members" },
  { label: "Hash", href: "/internal/hash" },
  { label: "Admin", href: "/internal/admin" },
  { label: "Audit", href: "/internal/audit" },
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,email,role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  if (role !== "member" && role !== "recruitment" && role !== "board") {
    redirect("/apply/dashboard");
  }

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
              {profile?.full_name ?? profile?.email} · {role}
            </p>
          </div>

          <nav className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/56">
            {links.map((link) => (              <a
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

      <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">
        {children}
      </div>
    </main>
  );
}
