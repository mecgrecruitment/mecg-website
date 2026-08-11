import React from "react";
import { createClient } from "@/lib/supabase/server";
import { requireMember, ROLE_LABELS } from "@/lib/auth";
import { approveMembership, createScoringAssignment, denyMembership } from "./actions";
import { SubmitButton } from "../../apply/SubmitButton";

export default async function MembersPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  const member = await requireMember();
  const params = await searchParams;
  const supabase = await createClient();
  const isBoard = member.role === "board";

  // Board-only reads remain protected by RLS and can run alongside the member list.
  const [memberResult, pendingResult, cycleResult] = await Promise.all([
    supabase
      .from("members")
      .select("id, full_name, email, role")
      .is("deleted_at", null)
      .order("full_name", { ascending: true }),
    isBoard
      ? supabase
          .from("membership_requests")
          .select("id, full_name, email, requested_role")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    isBoard
      ? supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const members = memberResult.data;
  const pending = pendingResult.data;
  const cycle = cycleResult.data;

  const { data: candidates } = isBoard && cycle
    ? await supabase
        .from("candidates")
        .select("id, full_name, email")
        .eq("cycle_id", cycle.id)
        .is("deleted_at", null)
        .order("full_name", { ascending: true })
    : { data: [] };

  return (
    <div className="grid gap-8">
      {params?.success ? <p className="rounded-xl border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-4 text-sm text-[var(--orange-soft)]">{params.success}</p> : null}
      {params?.error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{params.error}</p> : null}

      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Members</p>
        <h2 className="font-display mt-5 text-5xl font-bold uppercase tracking-[-0.07em] md:text-7xl">
          Access and assignments.
        </h2>
        <p className="mt-5 text-white/58">
          Board can approve access requests and assign members to score candidates.
        </p>
      </section>

      {isBoard ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <article className="panel rounded-[2rem] p-6">
            <p className="eyebrow">Pending Requests</p>
            <div className="mt-5 grid gap-3">
              {(pending ?? []).map((req) => (
                <div key={req.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="font-bold">{req.full_name}</p>
                  <p className="text-sm text-white/45">{req.email}</p>
                  <p className="mt-1 text-sm text-white/45">Requested: {req.requested_role}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      { value: "recruitment_committee", label: "Committee" },
                      { value: "board", label: "Board" },
                    ].map((role) => (
                      <form key={role.value} action={approveMembership}>
                        <input type="hidden" name="request_id" value={req.id} />
                        <input type="hidden" name="role" value={role.value} />
                        <SubmitButton pendingText="Approving...">Approve {role.label}</SubmitButton>
                      </form>
                    ))}

                    <form action={denyMembership}>
                      <input type="hidden" name="request_id" value={req.id} />
                      <SubmitButton pendingText="Denying...">Deny</SubmitButton>
                    </form>
                  </div>
                </div>
              ))}

              {(pending ?? []).length === 0 ? <p className="text-white/45">No pending requests.</p> : null}
            </div>
          </article>

          <article className="panel rounded-[2rem] p-6">
            <p className="eyebrow">Create Scoring Assignment</p>
            <form action={createScoringAssignment} className="mt-5 grid gap-3">
              <select name="stage" required className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-3">
                <option value="speed_dating">Speed Dating</option>
                <option value="group_case">Group Case</option>
                <option value="final_round">Final Round</option>
              </select>

              <select name="candidate_id" required className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-3">
                <option value="">Select candidate</option>
                {(candidates ?? []).map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.full_name} — {candidate.email}
                  </option>
                ))}
              </select>

              <select name="reviewer_id" required className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-3">
                <option value="">Select reviewer</option>
                {(members ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} — {m.email}
                  </option>
                ))}
              </select>

              <input name="team_label" placeholder="Team/table label, optional" className="rounded-xl border border-white/10 bg-white/[0.04] p-3" />

              <SubmitButton pendingText="Saving...">Save assignment</SubmitButton>
            </form>
          </article>
        </section>
      ) : null}

      <section className="panel overflow-x-auto rounded-[2rem] p-4">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="text-left text-white/45">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => (
              <tr key={m.id} className="border-t border-white/10">
                <td className="p-3 font-bold">{m.full_name}</td>
                <td className="p-3 text-white/55">{m.email}</td>
                <td className="p-3 text-white/55">{ROLE_LABELS[m.role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
