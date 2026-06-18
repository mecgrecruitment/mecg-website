import React from "react";
import Link from "next/link";
import { requestInternalAccount } from "../actions";

export default async function CreateInternalAccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <main className="min-h-screen bg-[var(--navy-950)] px-5 py-16 text-white md:px-8">
      <section className="mx-auto max-w-xl">
        <Link href="/member-login" className="text-sm text-white/44 hover:text-white">
          ← Back to member login
      </Link>

        <p className="eyebrow mt-8">Request Access</p>
        <h1 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Awaiting approval.
        </h1>
        <p className="mt-4 text-white/54">
          Create an internal account request. A current board member must approve you before you can enter the portal.
        </p>

        {error ? (
          <p className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <form action={requestInternalAccount} className="panel mt-8 grid gap-4 rounded-[2rem] p-6">
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
            <input name="password" type="password" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Requested role</span>
            <select name="requested_role" className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-4 outline-none focus:border-[var(--orange)]">
              <option value="member">Member</option>
              <option value="board">Board</option>
            </select>
            <span className="text-xs text-white/40">
              This is only a request. You cannot approve your own role.
            </span>
          </label>

          <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
            Request access
          </button>
        </form>
      </section>
    </main>
  );
}
