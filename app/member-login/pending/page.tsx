import React from "react";
import Link from "next/link";

export default async function PendingInternalAccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const email = params?.email;

  return (
    <main className="min-h-screen bg-[var(--navy-950)] px-5 py-16 text-white md:px-8">
      <section className="mx-auto max-w-2xl panel-strong rounded-[2rem] p-8">
        <p className="eyebrow">Awaiting Approval</p>
        <h1 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Your request is pending.
        </h1>
        <p className="mt-5 leading-7 text-white/62">
          A current board member must approve your internal account before you can access the MECG internal portal.
        </p>
        {email ? <p className="mt-4 text-sm text-white/40">Requested email: {email}</p> : null}

        <Link href="/member-login" className="mt-8 inline-block rounded-full border border-white/15 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 hover:border-[var(--orange)] hover:text-white">
          Back to login
        </Link>
      </section>
    </main>
  );
}
