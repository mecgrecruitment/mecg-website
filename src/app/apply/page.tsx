import { applicantEnter } from "./actions";

export default async function ApplicantLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Applicant Login</p>
        <h2 className="font-display mt-5 max-w-4xl text-5xl font-bold uppercase leading-[0.9] tracking-[-0.07em] md:text-7xl">
          Start or continue your application.
        </h2>
        <p className="mt-6 max-w-2xl text-white/58">
          Create a demo applicant account with an email and password, then return to see your submitted information.
        </p>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <form action={applicantEnter} className="panel grid max-w-xl gap-4 rounded-[2rem] p-6 md:p-8">
        <label className="grid gap-2">
          <span className="text-sm font-bold">Email</span>
          <input
            name="email"
            type="email"
            placeholder="applicant@umich.edu"
            required
            className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Password</span>
          <input
            name="password"
            type="password"
            placeholder="Create or enter password"
            required
            className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
          />
        </label>

        <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
          Enter applicant portal
        </button>
      </form>
    </div>
  );
}
