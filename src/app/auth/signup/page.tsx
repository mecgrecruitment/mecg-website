import React from "react";
import { signup } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen px-5 py-20 text-white md:px-8">
      <section className="container max-w-xl">
        <p className="eyebrow">Create account</p>
        <h1 className="display mt-5 text-6xl uppercase">Applicant account.</h1>

        {params.error && (
          <p className="mt-6 rounded-[1rem] border border-red-400/40 bg-red-500/10 p-4 text-red-100">
            {params.error}
          </p>
        )}

        <form action={signup} className="panel mt-8 grid gap-4 rounded-[2rem] p-7">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Full name</span>
            <input name="full_name" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Email</span>
            <input name="email" type="email" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Password</span>
            <input name="password" type="password" required minLength={8} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
            Create account
          </button>

          <a href="/auth/login" className="text-sm text-white/54 hover:text-white">
            Already have an account? Log in.
          </a>
        </form>
      </section>
    </main>
  );
}
