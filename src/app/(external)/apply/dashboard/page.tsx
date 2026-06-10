import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";

export default async function ApplicantDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?message=Log in to view your applicant dashboard.");
  }

  const { data: application } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id)
    .eq("cycle", "Winter 2026")
    .maybeSingle();

  const { data: events } = await supabase
    .from("recruitment_events")
    .select("*")
    .order("starts_at", { ascending: true });

  const { data: attendance } = await supabase
    .from("event_attendance")
    .select("event_id, checked_in_at")
    .eq("user_id", user.id);

  const attended = new Set((attendance ?? []).map((item) => item.event_id));

  return (
    <main className="px-5 py-20 text-white md:px-8">
      <section className="container grid gap-8">
        <div>
          <p className="eyebrow">Applicant dashboard</p>
          <h1 className="display mt-5 text-6xl uppercase md:text-8xl">Your MECG application.</h1>
        </div>

        {params.message && (
          <p className="rounded-[1rem] border border-[var(--orange)]/30 bg-[var(--orange)]/10 p-4 text-white/80">
            {params.message}
          </p>
        )}

        <section className="grid gap-5 md:grid-cols-2">
          <article className="panel rounded-[2rem] p-7">
            <p className="eyebrow">Application status</p>
            <h2 className="font-display mt-5 text-4xl font-bold uppercase tracking-[-0.05em]">
              {application?.status ?? "Not started"}
            </h2>
            <p className="mt-4 text-white/52">
              {application?.submitted_at
                ? `Submitted ${new Date(application.submitted_at).toLocaleString()}`
                : "Start your application when ready."}
            </p>
            <a href="/apply/account" className="mt-7 inline-block rounded-full bg-[var(--orange)] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em]">
              Open application
            </a>
          </article>

          <article className="panel rounded-[2rem] p-7">
            <p className="eyebrow">Event check-in</p>
            <h2 className="font-display mt-5 text-4xl font-bold uppercase tracking-[-0.05em]">
              Attendance portal.
            </h2>
            <p className="mt-4 text-white/52">
              Check in during open-rush events using your account and the event phrase shown at the event.
            </p>
            <a href="/apply/checkin" className="mt-7 inline-block rounded-full border border-white/10 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 hover:border-[var(--orange)]">
              Check in
            </a>
          </article>
        </section>

        <section className="panel rounded-[2rem] p-7">
          <p className="eyebrow">Recruitment events</p>
          <div className="mt-6 grid gap-3">
            {(events ?? []).map((event) => (
              <article key={event.id} className="grid gap-3 rounded-[1rem] border border-white/10 p-4 md:grid-cols-[1fr_12rem_8rem]">
                <div>
                  <h3 className="font-bold">{event.title}</h3>
                  <p className="mt-1 text-sm text-white/44">{event.location}</p>
                </div>
                <p className="text-sm text-white/54">
                  {new Date(event.starts_at).toLocaleString()}
                </p>
                <p className={attended.has(event.id) ? "text-[var(--orange)]" : "text-white/36"}>
                  {attended.has(event.id) ? "Checked in" : "Not checked in"}
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
