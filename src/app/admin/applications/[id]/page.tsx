import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { CLASS_YEAR_LABELS, type ClassYear } from "@/lib/workflow";
import LogoutButton from "@/components/logout-button";
import BoardNav from "../../board-nav";

export default async function ApplicantDossier({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE") ?? selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS");
  if (!cycleId) redirect("/member");
  if (!hasPermission(user.memberships, cycleId, "MANAGE_CYCLE") && !hasPermission(user.memberships, cycleId, "HASH_PANEL_ACCESS")) redirect("/member");
  const supabase = await createClient();
  const { data: application, error } = await supabase
    .from("applications")
    .select("id,status,resume_storage_path,cycle_id,pnms!inner(name,contact,preferred_name,phone,class_year,major,linkedin_url)")
    .eq("id", id)
    .eq("cycle_id", cycleId)
    .maybeSingle();
  if (error) throw error;
  if (!application) notFound();
  const { data: responses } = await supabase
    .from("application_responses")
    .select("question_key,question_text,response_text")
    .eq("application_id", id);
  const { data: conflict } = await supabase.from("conflict_declarations").select("id").eq("application_id", id).eq("declarer_id", user.id).maybeSingle();
  if (conflict) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="rounded-xl bg-amber-50 p-4">You are recused from this applicant.</p>
        <Link href="/admin" className="mt-4 inline-block underline">Back to pipeline</Link>
      </main>
    );
  }
  const person = application.pnms;
  const year = person.class_year && person.class_year in CLASS_YEAR_LABELS ? CLASS_YEAR_LABELS[person.class_year as ClassYear] : person.class_year;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-orange-700">{application.status}</p>
          <h1 className="text-3xl font-semibold">{person.name}</h1>
        </div>
        <LogoutButton />
      </header>
      <BoardNav current="/admin" />
      <section className="rounded-xl border p-5 text-sm leading-6">
        <p>{person.preferred_name ? `Preferred name: ${person.preferred_name}` : null}</p>
        <p>{person.contact}</p>
        {person.phone && <p>{person.phone}</p>}
        {year && <p>{year}</p>}
        {person.major && <p>{person.major}</p>}
        {person.linkedin_url && <p><a className="underline" href={person.linkedin_url}>{person.linkedin_url}</a></p>}
        {application.resume_storage_path ? (
          <p className="mt-3"><a className="button-primary inline-flex px-4" href={`/api/admin/applications/${application.id}/resume`}>Download resume</a></p>
        ) : (
          <p className="mt-3 text-gray-500">No resume on file.</p>
        )}
      </section>
      <section className="space-y-4">
        {(responses ?? []).map((response) => (
          <article key={response.question_key} className="rounded-xl border p-5">
            <h2 className="font-medium">{response.question_text}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{response.response_text}</p>
          </article>
        ))}
      </section>
      <Link href="/admin" className="underline">Back to pipeline</Link>
    </main>
  );
}
