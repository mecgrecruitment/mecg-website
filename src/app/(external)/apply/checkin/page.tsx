import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { checkIn } from "./actions";

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?message=Log in before checking in.");
  }

  const { data: events } = await supabase
    .from("recruitment_events")
    .select("id,title,starts_at,location")
    .order("starts_at", { ascending: true });

  return (
    <main className="px-5 py-20 text-white md:px-8">
      <section className="container max-w-2xl">
        <p className="eyebrow">Event check-in</p>
        <h1 className="display mt-5 text-6xl uppercase">Attendance pass.</h1>
        <p className="mt-6 text-white/56">
          This uses account-based check-in plus an event phrase. It is harder to fake than a shared Google Form code and feels less like copying another club.
        </p>

        {params.error && (
          <p className="mt-6 rounded-[1rem] border border-red-400/40 bg-red-500/10 p-4 text-red-100">
            {params.error}
          </p>
        )}

        <form action={checkIn} className="panel mt-8 grid gap-4 rounded-[2rem] p-7">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Event</span>
            <select name="event_id" required className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-4 text-white outline-none focus:border-[var(--orange)]">
              {(events ?? []).map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} — {new Date(event.starts_at).toLocaleString()}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Event phrase</span>
            <input name="phrase" required placeholder="Shown at the event" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 uppercase outline-none focus:border-[var(--orange)]" />
          </label>

          <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
            Check in
          </button>
        </form>
      </section>
    </main>
  );
}
