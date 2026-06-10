import { createAdminClient } from "@/lib/supabase/admin";
import type { ApplyQuestion } from "@/lib/apply/schema";
import ApplicationForm from "./ApplicationForm";

// EX-67: external routes are Static/ISR. Question config changes rarely;
// revalidate keeps the page static while picking up board edits.
export const revalidate = 300;

async function getIntakeConfig(): Promise<{
  open: boolean;
  questions: ApplyQuestion[];
}> {
  try {
    const supabase = createAdminClient();
    const { data: cycle } = await supabase
      .from("recruitment_cycles")
      .select("id, applications_open_at, applications_close_at")
      .eq("is_active", true)
      .maybeSingle();

    if (!cycle) return { open: false, questions: [] };

    const now = new Date();
    const open =
      (!cycle.applications_open_at ||
        new Date(cycle.applications_open_at) <= now) &&
      (!cycle.applications_close_at ||
        new Date(cycle.applications_close_at) > now);
    if (!open) return { open: false, questions: [] };

    const { data: questions } = await supabase
      .from("application_questions")
      .select("key, prompt, required")
      .eq("cycle_id", cycle.id)
      .order("sort_order");

    return { open: true, questions: questions ?? [] };
  } catch {
    // DB unreachable (e.g. build without a running stack) → closed state,
    // never a broken page (EX-74).
    return { open: false, questions: [] };
  }
}

export default async function ApplyPage() {
  const { open, questions } = await getIntakeConfig();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  return (
    <main>
      <section className="grid-bg relative px-5 py-20 md:px-8 md:py-28">
        <div className="orb right-[-12rem] top-[-12rem] h-[34rem] w-[34rem] bg-[var(--orange-dark)]" />

        <div className="container relative grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div>
            <p className="eyebrow" data-reveal>
              Application
            </p>
            <h1
              className="display mt-7 max-w-4xl text-6xl uppercase text-white md:text-8xl"
              data-reveal
            >
              Apply to MECG.
            </h1>
            <p
              className="mt-8 max-w-2xl text-xl leading-relaxed text-white/60"
              data-reveal
            >
              MECG is open to University of Michigan students across majors.
              The application asks for basic academic information, a resume,
              and short written responses.
            </p>

            <aside className="panel-strong mt-10 rounded-[2rem] p-7 md:p-9" data-reveal>
              <p className="eyebrow">Application materials</p>

              <div className="mt-8 grid gap-1">
                {[
                  "University of Michigan email",
                  "Graduation year and major",
                  "Resume PDF",
                  "Short written responses",
                  "Interest in consulting and teamwork",
                ].map((item, index) => (
                  <div
                    key={item}
                    className="grid grid-cols-[3rem_1fr] items-center border-b border-white/10 py-5"
                  >
                    <span className="text-sm font-bold text-[var(--orange)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-semibold text-white/72">{item}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          <div>
            {open && siteKey ? (
              <ApplicationForm questions={questions} siteKey={siteKey} />
            ) : (
              <aside className="panel-strong rounded-[2rem] p-7 md:p-9">
                <p className="eyebrow">Status</p>
                <h2 className="font-display mt-5 text-3xl font-bold uppercase tracking-[-0.05em] text-white">
                  Applications are closed.
                </h2>
                <p className="mt-4 leading-relaxed text-white/60">
                  Applications for the next cycle are not open yet. Check the
                  recruitment timeline for dates and info sessions.
                </p>
                <a
                  href="/recruitment"
                  className="focus-ring mt-7 inline-block rounded-full bg-[var(--orange)] px-7 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white transition hover:bg-white hover:text-[var(--navy-950)]"
                >
                  View recruitment timeline
                </a>
              </aside>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
