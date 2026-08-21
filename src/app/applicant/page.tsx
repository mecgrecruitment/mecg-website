import { redirect } from "next/navigation";
import { currentDestination, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PortalShell from "@/components/portal-shell";
import LogoutButton from "@/components/logout-button";

export default async function ApplicantDashboard() {
  await requireUser();
  const destination = await currentDestination();
  if (destination !== "/applicant") redirect(destination ?? "/login");
  const supabase = await createClient();
  const { data: applications, error } = await supabase.rpc("applicant_dashboard");
  if (error) throw error;
  if (!applications?.length) redirect("/apply");
  return <PortalShell eyebrow="Applicant portal" title={`Welcome, ${applications[0].applicant_name}.`} description="Only outcomes released by MECG appear here."><div className="space-y-4">{applications.map((application) => <section key={application.application_id} className="rounded-2xl bg-mecg-navy/[0.035] p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]"><p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/45">{application.cycle_name}</p><p className="mt-3 text-2xl font-semibold">{application.released_outcome ?? application.display_status}</p><p className="mt-3 text-sm leading-6 text-mecg-navy/60">{application.released_outcome ? "This outcome has been approved and released by the MECG Board." : "No final outcome has been released."}</p></section>)}</div><div className="mt-6"><LogoutButton /></div></PortalShell>;
}
