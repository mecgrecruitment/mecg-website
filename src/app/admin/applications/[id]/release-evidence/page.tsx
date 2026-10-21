import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { applicantCode } from "@/lib/applicant-code";
import { createClient } from "@/lib/supabase/server";
import { parseReleaseEvidence, releaseEvidenceHref } from "@/lib/release-evidence";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import ReleaseEvidenceView from "./evidence-view";

export const metadata: Metadata = { title: "Release evidence", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ReleaseEvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdmin();
  const supabase = await createClient();
  const application = await supabase.from("applications").select("cycle_id").eq("id", id).maybeSingle();
  if (application.error) throw new Error("Application lookup is unavailable. Try again.");
  if (!application.data) notFound();
  const cycleId = application.data.cycle_id;
  if (!hasPermission(user.memberships, cycleId, "RELEASE")) redirect("/access-denied");
  let result;
  try { result = await supabase.rpc("decision_evidence_diagnostics", { target_application_id: id }); }
  catch { result = { data: null, error: { code: "unavailable" } }; }
  if (result.error?.code === "42501" || result.error?.code === "P0002") notFound();
  const report = result.error ? null : parseReleaseEvidence(result.data);
  const usable = report?.applicationId === id ? report : null;
  return <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
    <WorkspaceHeader eyebrow={applicantCode(id)} title="Release evidence" description="Find the required rounds and valid evidence behind a blocked outcome." />
    <WorkspaceNav user={user} cycleId={cycleId} current="/admin" />
    <nav aria-label="Evidence recovery" className="flex flex-wrap gap-4 text-sm font-semibold">
      <Link href={withWorkspaceCycle("/admin", cycleId)} className="inline-flex min-h-11 items-center underline underline-offset-4">Back to recruitment</Link>
      <Link href={withWorkspaceCycle(`/admin/applications/${encodeURIComponent(id)}`, cycleId)} className="inline-flex min-h-11 items-center underline underline-offset-4">Open applicant dossier</Link>
      <a href={releaseEvidenceHref(id, cycleId)} className="inline-flex min-h-11 items-center underline underline-offset-4">Reload evidence</a>
    </nav>
    {usable ? <ReleaseEvidenceView report={usable} cycleId={cycleId} /> : <section role="status" className="border-y border-line py-5"><h2 className="text-xl font-semibold">Evidence could not be checked</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Current round details are unavailable. No readiness or release result is confirmed. Reload this page to try again, or ask the recruitment owner to check the underlying issue. Keep the outcome blocked until a new release review confirms it is eligible.</p></section>}
  </main>;
}
