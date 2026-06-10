import Link from "next/link";
import { memberLogin } from "./actions";

export default function MemberLoginPage() {
  return (
    <main className="min-h-screen bg-[var(--navy-950)] px-5 py-16 text-white md:px-8">
      <section className="mx-auto max-w-xl">
        <Link href="/" className="text-sm text-white/44 hover:text-white">
          ← Back to main site
        </Link>

        <p className="eyebrow mt-8">Member Login</p>
        <h1 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Internal portal.
        </h1>
        <p className="mt-4 text-white/54">
          Demo login for members, recruitment team, and board.
        </p>

        <form action={memberLogin} className="panel mt-8 grid gap-4 rounded-[2rem] p-6">
          <label classNe="grid gap-2">
            <span className="text-sm font-bold">Email</span>
            <input defaultValue="amanigupta25@gmail.com" name="email" type="email" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Password</span>
            <input defaultValue="demo123" name="password" type="password" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
            Log in to internal portal
          </button>
        </form>
      </section>
    </main>
  );
}
