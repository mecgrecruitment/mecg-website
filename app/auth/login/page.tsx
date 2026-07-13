import React from "react";
import { login } from "../actions";
import { GoogleButton } from "../GoogleButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "";

  return (
    <main className="portal-shell grid min-h-screen place-items-center px-5 py-20 text-white md:px-8">
      <section className="container max-w-xl rounded-[2rem] border border-white/10 bg-[rgba(8,18,37,0.78)] p-6 shadow-[var(--shadow-card)] md:p-9">
        <p className="eyebrow">Login</p>
        <h1 className="display mt-5 text-6xl uppercase">MECG account.</h1>

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

        <div className="mt-8 grid gap-5 border-t border-white/10 pt-7">
          <GoogleButton next={next || undefined} />

          <div className="flex items-center gap-3 text-[0.6rem] uppercase tracking-[0.2em] text-white/35">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form action={login} className="grid gap-4">
            {next ? <input type="hidden" name="next" value={next} /> : null}

            <label className="grid gap-2">
              <span className="text-sm font-bold">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="focus-ring min-h-12 rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
              />
            </label>

            <label className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Password</span>
                <a href="/auth/forgot" className="text-xs text-white/50 hover:text-white">
                  Forgot password?
                </a>
              </div>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="focus-ring min-h-12 rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
              />
            </label>

            <button className="button-primary focus-ring cursor-pointer">
              Log in
            </button>
          </form>

          <a href="/auth/signup" className="text-sm text-white/54 hover:text-white">
            Need an account? Create one.
          </a>
        </div>
      </section>
    </main>
  );
}
