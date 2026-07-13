import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requestMembership } from "../actions";
import { AuthShell } from "@/components/portal/AuthShell";

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
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    redirect("/auth/login?next=/auth/request-access&message=Member access requires the configured account service.");
  }
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
    <AuthShell
      eyebrow="Internal membership"
      title="Request access."
      description="Internal recruitment tools are limited to current MECG members. A board member verifies each request before access is activated."
    >
        <p className="eyebrow">Member access</p>
        <h2 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em] md:text-5xl">Confirm your role.</h2>
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
                className="portal-field focus-ring"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Requested role</span>
              <select
                name="requested_role"
                defaultValue="member"
                className="portal-field focus-ring bg-[var(--navy-900)]"
              >
                <option value="member">Recruitment Committee Member</option>
                <option value="board">Board</option>
              </select>
            </label>

            <button className="button-primary focus-ring cursor-pointer">
              Submit request
            </button>
          </form>
        )}

        <a href="/apply/dashboard" className="mt-6 inline-block text-sm text-white/54 hover:text-white">
          Back to your dashboard.
        </a>
    </AuthShell>
  );
}
