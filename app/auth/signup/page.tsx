import React from "react";
import { signup } from "../actions";
import { GoogleButton } from "../GoogleButton";

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
        <h1 className="display mt-5 text-6xl uppercase">Join MECG.</h1>
        <p className="mt-4 text-white/55">
          Applicants and prospective members start here. We&apos;ll email you a link
          to confirm your address.
        </p>

        {params.error && (
          <p className="mt-6 rounded-[1rem] border border-red-400/40 bg-red-500/10 p-4 text-red-100">
            {params.error}
          </p>
        )}

        <div className="panel mt-8 grid gap-5 rounded-[2rem] p-7">
          <GoogleButton label="Sign up with Google" />

          <div className="flex items-center gap-3 text-[0.6rem] uppercase tracking-[0.2em] text-white/35">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form action={signup} className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold">Full name</span>
              <input
                name="full_name"
                required
                autoComplete="name"
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Password</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
              />
              <span className="text-xs text-white/40">At least 8 characters.</span>
            </label>

            <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
              Create account
            </button>
          </form>

          <a href="/auth/login" className="text-sm text-white/54 hover:text-white">
            Already have an account? Log in.
          </a>
        </div>
      </section>
    </main>
  );
}
