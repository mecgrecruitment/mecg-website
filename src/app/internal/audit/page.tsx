import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

export default async function AuditPage() {
  const supabase = createDemoAdminClient();

  const { data: applications } = await supabase
    .from("demo_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: checkins } = await supabase
    .from("demo_checkins")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Audit</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Activity log.
        </h2>
        <p className="mt-4 text-white/54">
          Demo audit feed showing recent application and attendance activity.
        </p>
      </section>

      <section className="panel rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Recent activity</p>
        <div className="mt-5 grid gap-3">
          {(applications ?? []).map((app) => (
            <article key={`app-${app.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-bold">Application submitted</p>
              <p className="text-sm text-white/44">{app.full_name} · {app.email}</p>
            </article>
          ))}
          {(checkins ?? []).map((checkin) => (
            <article key={`checkin-${checkin.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-bold">Attendance check-in</p>
              <p className="text-sm text-white/44">{checkin.email} · {checkin.event_name}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
