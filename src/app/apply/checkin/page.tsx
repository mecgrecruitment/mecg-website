import { submitDemoCheckin } from "./actions";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

export default async function ApplicantCheckinPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;
  const email = params?.email ?? "";

  const supabase = createDemoAdminClient();
  const { data: events } = await supabase
    .from("demo_events")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true });

  return (
    <div className="grid gap-8">
      <section>
        <p className="eyebrow">Attendance</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em] md:text-7xl">
          Event check-in.
        </h2>
        <p className="mt-4 max-w-2xl text-white/54">
          Enter your email and the exact event phrase. Invalid codes will not be accepted.
        </p>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form action={submitDemoCheckin} className="panel grid gap-4 rounded-[2rem] p-6 md:p-8">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Email</span>
            <input defaultValue={email} name="email" type="email" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Event phrase</span>
            <input name="event_phrase" placeholder="BLUEGEAR" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4 uppercase outline-none focus:border-[var(--orange)]" />
          </label>

          <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
            Check in
          </button>
        </form>

        <div className="panel rounded-[2rem] p-6 md:p-8">
          <p className="eyebrow">Valid demo codes</p>
          <div className="mt-5 grid gap-3">
            {(events ?? []).map((event) => (
              <article key={event.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div>
                  <h3 className="font-bold">{event.title}</h3>
                  <p className="text-sm text-white/44">
                    {event.event_date} · {event.location}
                  </p>
                </div>
                <p className="font-mono text-sm font-bold tex-[var(--orange)]">
                  {event.attendance_code}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
