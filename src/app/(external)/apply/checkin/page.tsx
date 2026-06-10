import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { checkIn } from "./actions";

// TODO(Track B): event list comes from cycle configuration (§9.14) once the
// event/attendance model is specced — see actions.ts.
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

  return (
    <main className="px-5 py-20 text-white md:px-8">
      <section className="container max-w-2xl">
        <p className="eyebrow">Event check-in</p>
        <h1 className="display mt-5 text-6xl uppercase">Attendance pass.</h1>
        <p className="mt-6 text-white/56">
          Account-based check-in with an event phrase. Check-in opens alongside
          Fall 2026 recruitment events.
        </p>

        {params.error && (
          <p className="mt-6 rounded-card border border-red-400/40 bg-red-500/10 p-4 text-red-100">
            {params.error}
          </p>
        )}

        <form action={checkIn} className="panel mt-8 grid gap-4 rounded-panel p-7">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Event phrase</span>
            <input
              name="phrase"
              required
              placeholder="Shown at the event"
              className="rounded-sm border border-rule bg-white/[0.04] p-4 uppercase outline-none focus:border-accent"
            />
          </label>

          <button className="rounded-pill bg-accent px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
            Check in
          </button>
        </form>
      </section>
    </main>
  );
}
