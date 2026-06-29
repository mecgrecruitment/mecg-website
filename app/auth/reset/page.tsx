import React from "react";
import { updatePassword } from "../actions";

// Reached after the recovery link hits /auth/callback (which exchanges the code
// and forwards here with a live recovery session). updatePassword verifies the
// session server-side, so a direct visit without a valid link is rejected.
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen px-5 py-20 text-white md:px-8">
      <section className="container max-w-xl">
        <p className="eyebrow">Reset password</p>
        <h1 className="display mt-5 text-6xl uppercase">New password.</h1>
        <p className="mt-4 text-white/55">Choose a new password for your account.</p>

        {params.error && (
          <p className="mt-6 rounded-[1rem] border border-red-400/40 bg-red-500/10 p-4 text-red-100">
            {params.error}
          </p>
        )}

        <form action={updatePassword} className="panel mt-8 grid gap-4 rounded-[2rem] p-7">
          <label className="grid gap-2">
            <span className="text-sm font-bold">New password</span>
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
            Update password
          </button>
        </form>
      </section>
    </main>
  );
}
