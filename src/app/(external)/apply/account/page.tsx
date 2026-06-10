import { redirect } from "next/navigation";
import { submitApplication } from "./actions";
import { createClient } from "../../../../lib/supabase/server";

export default async function ApplyAccountPage({
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
    redirect("/auth/login?message=Create or log into your account to apply.");
  }

  return (
    <main className="px-5 py-20 text-white md:px-8">
      <section className="container max-w-4xl">
        <p className="eyebrow">Application</p>
        <h1 className="display mt-5 text-6xl uppercase md:text-8xl">Submit your application.</h1>

        {params.error && (
          <p className="mt-6 rounded-[1rem] border border-red-400/40 bg-red-500/10 p-4 text-red-100">
            {params.error}
          </p>
        )}

        <form action={submitApplication} className="panel mt-10 grid gap-5 rounded-[2rem] p-7" encType="multipart/form-data">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-bold">Graduation year</span>
              <input name="grad_year" required placeholder="2028" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Major</span>
              <input name="major" required placeholder="Computer Science" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Resume PDF</span>
            <input name="resume" type="file" accept="application/pdf" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Why MECG?</span>
            <textarea name="answer_why_mecg" required rows={5} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Tell us about a time you worked on a team.</span>
            <textarea name="answer_teamwork" required rows={5} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Tell us about a problem you solved.</span>
            <textarea name="answer_problem_solving" required rows={5} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Anything else?</span>
            <textarea name="answer_anything_else" rows={4} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
            Submit application
          </button>
        </form>
      </section>
    </main>
  );
}
