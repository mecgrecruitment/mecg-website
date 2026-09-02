import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import ReadinessPanel from "./readiness-panel";

export const metadata: Metadata = { title: "Operations readiness" };

export default async function OperationsPage() {
  const user = await requireAdmin();
  if (!user.memberships.some((membership) => membership.active && membership.role === "OWNER")) {
    redirect("/access-denied");
  }

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-[13px] font-semibold text-mecg-orange-ink">Owner tools</p>
          <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em]">Operations readiness</h1>
          <p className="mt-2 max-w-2xl text-mecg-navy/65">Check required configuration and the live database without exposing secret values.</p>
        </div>
        <Link href="/admin" className="button-secondary">Board dashboard</Link>
      </header>
      <ReadinessPanel />
    </main>
  );
}
