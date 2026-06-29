import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requestMembership } from "../actions";

const STATUS_COPY: Record<string, string> = {
  pending: "Your request is pending board review. We'll email you once it's decided.",
  approved: "You're approved. Log out and back in to enter the member portal.",
  denied: "Your previous request wasn't approved. You can submit a new one below.",
};

export default async function RequestAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?next=/auth/request-access");
  }

  // Members don't request access — they already have it.
  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (member) {
    redirect("/internal");
  }

  const { data: existing } = await supabase
    .from("membership_requests")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  const status = existing?.status as "pending" | "approved" | "denied" | undefined;
  const showForm = !status || status === "denied";
  const defaultName = (user.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <main className="min-h-screen px-5 py-20 text-white md:px-8">
      <section className="container max-w-xl">
        <p className="eyebrow">Member access</p>
        <h1 className="display mt-5 text-6xl uppercase">Request access.</h1>
        <p className="mt-4 text-white/55">
          Current members and board can request access to the internal recruitment portal.
          A board member reviews every request.
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

        {status && (
          <p className="mt-6 rounded-[1rem] border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-4 text-white/80">
            {STATUS_COPY[status]}
          </p>
        )}

        {showForm && (
          <form action={requestMembership} className="panel mt-8 grid gap-4 rounded-[2rem] p-7">
            <label className="grid gap-2">
              <span className="text-sm font-bold">Full name</span>
              <input
                name="full_name"
                required
                defaultValue={defaultName}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Requested role</span>
              <select
                name="requested_role"
                defaultValue="member"
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
              >
                <option value="member">Recruitment Committee Member</option>
                <option value="board">Board</option>
              </select>
            </label>

            <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
              Submit request
            </button>
          </form>
        )}

        <a href="/apply/dashboard" className="mt-6 inline-block text-sm text-white/54 hover:text-white">
          Back to your dashboard.
        </a>
      </section>
    </main>
  );
}
