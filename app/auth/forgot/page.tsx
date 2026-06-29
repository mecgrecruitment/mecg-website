import React from "react";
import { requestPasswordReset } from "../actions";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen px-5 py-20 text-white md:px-8">
      <section className="container max-w-xl">
        <p className="eyebrow">Reset password</p>
        <h1 className="display mt-5 text-6xl uppercase">Forgot it?</h1>
        <p className="mt-4 text-white/55">
          Enter your email and we&apos;ll send a link to set a new password.
        </p>

        {params.message && (
          <p className="mt-6 rounded-[1rem] border border-white/10 bg-white/[0.05] p-4 text-white/70">
            {params.message}
          </p>
        )}

        {params.error && (
          <p className="mt-6 rounded-[1rem] border border-red-400/40 bg-red-500/10 p-4 text-red-100">
            {params.error}
          </p>
        )}

        <form action={requestPasswordReset} className="panel mt-8 grid gap-4 rounded-[2rem] p-7">
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

          <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
            Send reset link
          </button>

          <a href="/auth/login" className="text-sm text-white/54 hover:text-white">
            Back to log in.
          </a>
        </form>
      </section>
    </main>
  );
}
