import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal",
  description: "Choose the MECG applicant or approved-member account path.",
  robots: { index: false, follow: false },
};

export default function PortalPage() {
  return (
    <main className="portal-shell min-h-screen px-5 py-10 text-white md:px-8 md:py-16">
      <section className="mx-auto grid max-w-6xl gap-8">
        <div className="grid gap-8 rounded-[2rem] border border-white/10 bg-white/[0.025] p-7 md:grid-cols-[1fr_auto] md:items-end md:p-10">
          <div>
            <p className="eyebrow">MECG Portal</p>
            <h1 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em] md:text-7xl">
              Choose your path.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/58">
              One account system routes applicants and approved members to the right secure workspace.
            </p>
          </div>
          <Link href="/" className="portal-nav-link focus-ring">Main website ↗</Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/apply/create"
            className="panel card-hover rounded-[2rem] p-7"
          >
            <p className="eyebrow">01 — Applicant</p>
            <h2 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
              Apply / Create Account
            </h2>
            <p className="mt-4 text-white/52">
              Create an account, record event check-ins, and submit application materials.
            </p>
            <p className="annotation mt-10 text-white/35">Open applicant access →</p>
          </Link>

          <Link
            href="/member-login"
            className="panel card-hover rounded-[2rem] p-7"
          >
            <p className="eyebrow">02 — Members</p>
            <h2 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
              Member Login
            </h2>
            <p className="mt-4 text-white/52">
              Log in as a member, recruitment chair, or board member.
            </p>
            <p className="annotation mt-10 text-white/35">Open member access →</p>
          </Link>
        </div>

        <p className="text-center text-xs leading-6 text-white/35">
          Internal access requires board approval. Applicant and member records remain separated by role.
        </p>
      </section>
    </main>
  );
}
