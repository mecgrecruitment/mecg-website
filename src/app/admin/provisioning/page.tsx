import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import type { Metadata } from "next";
import Link from "@/components/workspace-link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import { createClient } from "@/lib/supabase/server";
import { cycleStatusLabel } from "@/lib/labels";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import OperationNotice from "@/components/operation-notice";
import ResolveButton from "./resolve-button";

export const metadata: Metadata = { title: "Account setup incidents", robots: { index: false, follow: false } };

const PAGE_SIZE = 100;
const PHASE_LABELS: Record<string, string> = {
  CREATE_ACCOUNT: "creating the Clerk account",
  IDENTITY_LINK: "linking the MECG identity",
  MEMBERSHIP_GRANT: "granting cycle membership",
};
const PHASE_GUIDANCE: Record<string, string> = {
  CREATE_ACCOUNT: "If no Clerk user ID was returned, the creation outcome may be uncertain. Look up the email before creating another account.",
  IDENTITY_LINK: "Check whether the Clerk account and MECG identity are already linked before retrying account setup.",
  MEMBERSHIP_GRANT: "The linked account and MECG profile may have been preserved to protect existing access, including other cycles. Inspect memberships before changing or retrying the account.",
};
const dateTime = (value: string) => new Date(value).toLocaleString("en-US", {
  timeZone: "America/Detroit", dateStyle: "medium", timeStyle: "short",
});

export default async function ProvisioningPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[]; cycleId?: string | string[] }>;
}) {
  const user = await requireAdmin();
  const query = await searchParams;
  const cycleId = await selectWorkspaceCycle(user.memberships, "MANAGE_MEMBERSHIPS");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "MANAGE_MEMBERSHIPS")) redirect("/access-denied");
  const requestedPage = typeof query.page === "string" && /^\d{1,5}$/.test(query.page) ? Number(query.page) : 1;
  const page = Math.max(1, Math.min(10000, requestedPage));
  const offset = (page - 1) * PAGE_SIZE;
  const supabase = await createClient();
  const [cycleResult, incidentsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("provisioning_incidents")
      .select("id,cycle_id,email,clerk_user_id,app_user_id,phase,clerk_cleanup_failed,profile_cleanup_failed,created_at,resolved_at", { count: "exact" })
      .eq("cycle_id", cycleId).is("resolved_at", null)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1),
  ]);
  if (cycleResult.error || !cycleResult.data) redirect("/admin/people");
  const cycle = cycleResult.data;
  const incidents = incidentsResult.data ?? [];
  const total = incidentsResult.count ?? incidents.length;
  const pageHref = (nextPage: number) => `/admin/provisioning?cycleId=${encodeURIComponent(cycleId)}&page=${nextPage}`;

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)}`} title="Account setup incidents"
        description="Review incomplete account setup and record resolution after checking the account and membership." />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/people" />
      <Link href={withWorkspaceCycle("/admin/people", cycleId)} className="text-sm font-semibold text-mecg-navy underline underline-offset-4">Back to People</Link>
      <section aria-labelledby="remediation-heading" className="border-y border-line py-5">
        <h2 id="remediation-heading" className="text-lg font-semibold text-mecg-navy">Check before retrying account setup</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
          <li>Find the account in Clerk using the email and any recorded Clerk user ID. An unavailable ID means the provider outcome needs checking.</li>
          <li>Check the MECG identity and this cycle&apos;s membership in People. Confirm whether access exists before retrying or changing an account.</li>
          <li>Complete any needed remediation through the appropriate account controls, then mark the incident resolved. This page records resolution; it does not repair accounts or send emails.</li>
        </ol>
      </section>
      {incidentsResult.error ? (
        <OperationNotice kind="error">Account setup incidents could not be loaded. Reload this page to try again. No resolution has been recorded.</OperationNotice>
      ) : (
        <section aria-labelledby="incident-heading">
          <h2 id="incident-heading" className="text-xl font-semibold text-mecg-navy">Unresolved incidents</h2>
          <p className="mt-2 text-sm text-muted">{total === 0 ? "No unresolved incidents in this cycle." : `${total} unresolved · oldest first · up to ${PAGE_SIZE} per page`}</p>
          <div className="mt-4 divide-y divide-line border-y border-line">
            {incidents.map((incident) => (
              <article key={incident.id} className="grid gap-5 py-6 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <h3 className="break-all text-base font-semibold text-mecg-navy">{incident.email}</h3>
                  <p className="mt-1 text-sm text-muted">Stopped while {PHASE_LABELS[incident.phase] ?? "setting up the account"}.</p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{PHASE_GUIDANCE[incident.phase] ?? "Inspect the account, identity and cycle membership before retrying."}</p>
                  <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm leading-6 sm:grid-cols-[8rem_minmax(0,1fr)]">
                    <dt className="text-muted">Incident reference</dt><dd className="break-all font-mono text-xs text-mecg-navy">{incident.id}</dd>
                    <dt className="text-muted">Recorded</dt><dd className="text-mecg-navy"><time dateTime={incident.created_at}>{dateTime(incident.created_at)} Eastern</time></dd>
                    <dt className="text-muted">Clerk user ID</dt><dd className="break-all text-mecg-navy">{incident.clerk_user_id ? <span className="font-mono text-xs">{incident.clerk_user_id}</span> : "Not available — check Clerk"}</dd>
                    <dt className="text-muted">MECG user ID</dt><dd className="break-all text-mecg-navy">{incident.app_user_id ? <span className="font-mono text-xs">{incident.app_user_id}</span> : "Not recorded"}</dd>
                    <dt className="text-muted">Cleanup checks</dt><dd className="text-mecg-navy">{[
                      ...(incident.clerk_cleanup_failed ? ["Clerk cleanup needs review"] : []),
                      ...(incident.profile_cleanup_failed ? ["MECG profile cleanup needs review"] : []),
                    ].join(" · ") || "No failed cleanup recorded. Cleanup may not have been attempted; inspect the account and membership."}</dd>
                  </dl>
                </div>
                <ResolveButton incidentId={incident.id} />
              </article>
            ))}
          </div>
          {incidents.length === 0 && total > 0 && <p className="mt-4 text-sm text-muted">No incidents on this page. Return to the first page to review the current queue.</p>}
          {(page > 1 || offset + incidents.length < total) && (
            <nav aria-label="Incident pages" className="mt-5 flex flex-wrap items-center gap-4 text-sm font-semibold text-mecg-navy">
              {page > 1 && <Link href={pageHref(page - 1)} className="button-secondary">Previous page</Link>}
              <span className="tabular">Page {page}</span>
              {offset + incidents.length < total && <Link href={pageHref(page + 1)} className="button-secondary">Next page</Link>}
              {page > 1 && <Link href={pageHref(1)} className="underline underline-offset-4">First page</Link>}
            </nav>
          )}
        </section>
      )}
    </main>
  );
}
