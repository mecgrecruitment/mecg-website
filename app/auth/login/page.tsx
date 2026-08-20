import React from "react";
import { login } from "../actions";
import { AuthShell } from "@/components/portal/AuthShell";
import { safeNextPath } from "@/lib/auth/schema";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const signupHref = next
    ? `/auth/signup?next=${encodeURIComponent(next)}`
    : "/auth/signup";

  return (
    <AuthShell
      eyebrow="Account access"
      title="Log in."
      description="One account for applicants and members. Use your @umich.edu email."
    >
      <p className="eyebrow">Login</p>
      <h2 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em] md:text-5xl">
        Continue.
      </h2>
      <p className="mt-4 text-white/55">
        After you sign in, we route you to the applicant dashboard or the member
        workspace from your account — there is no separate member login.
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

      <div className="mt-8 grid gap-5 border-t border-white/10 pt-7">
        <form action={login} className="grid gap-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}

          <label className="grid gap-2">
            <span className="text-sm font-bold">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="uniqname@umich.edu"
              className="portal-field focus-ring"
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
              className="portal-field focus-ring"
            />
          </label>

          <button className="button-primary focus-ring cursor-pointer">
            Log in
          </button>
        </form>

        <a href={signupHref} className="text-sm text-white/54 hover:text-white">
          Need an account? Create one with your @umich.edu email.
        </a>
      </div>
    </AuthShell>
  );
}
