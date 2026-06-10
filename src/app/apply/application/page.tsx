import { submitDemoApplication } from "./actions";

export default async function ApplyApplicationPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;
  const email = params?.email ?? "";

  return (
    <div className="grid gap-8">
      <section>
        <p className="eyebrow">Application</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em] md:text-7xl">
          Submit your application.
        </h2>
        <p className="mt-4 max-w-2xl text-white/54">
          This demo saves applicant responses into Supabase demo storage.
        </p>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <form action={submitDemoApplication} className="panel grid gap-5 rounded-[2rem] p-6 md:p-8">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Full name</span>
            <input name="full_name" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Email</span>
            <input defaultValue={email} name="email" type="email" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Year</span>
            <input name="year" placeholder="2028" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Major</span>
            <input name="major" placeholder="Business, CS, Engineering..." className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Resume upload</span>
          <input name="resume" type="file" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/60 outline-none file:mr-4 file:rounded-full file:border-0 file:bg-[var(--orange)] file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:text-white" />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Why do you want to join MECG?</span>
          <textarea name="why_mecg" required rows={5} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Tell us about a time you worked on a team.</span>
          <textarea name="teamwork" required rows={5} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Describe a problem you broke down and solved.</span>
          <textarea name="problem_solving" required rows={5} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
        </label>

        <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
          Submit application
        </button>
      </form>
    </div>
  );
}
