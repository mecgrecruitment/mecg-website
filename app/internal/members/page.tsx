import React from "react";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";
import { requireInternalSession } from "@/lib/internal-portal/session";
import { approveInternalAccount, createScoringAssignment, denyInternalAccount } from "./actions";

export default async function MembersPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  const session = await requireInternalSession();
  const params = await searchParams;
  const supabase = createDemoAdminClient();

  const { data: members } = await supabase
    .from("demo_internal_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: candidates } = await supabase
    .from("demo_applications")
    .select("email,full_name")
    .order("full_name", { ascending: true });

  const approvedMembers = (members ?? []).filter((m) => m.approval_status === "approved");
  const pending = (members ?? []).filter((m) => m.approval_status === "pending");

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
          Board can approve accounts and assign members to score candidates.
        </p>
      </section>

      {session.role === "board" ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <article className="panel rounded-[2rem] p-6">
            <p className="eyebrow">Pending Requests</p>
            <div className="mt-5 grid gap-3">
              {pending.map((account) => (
                <div key={account.email} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="font-bold">{account.full_name}</p>
                  <p className="text-sm text-white/45">{account.email}</p>
                  <p className="mt-1 text-sm text-white/45">Requested: {account.requested_role}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {["member", "board"].map((role) => (
                      <form key={role} action={approveInternalAccount}>
                        <input type="hidden" name="email" value={account.email} />
                        <input type="hidden" name="role" value={role} />
                        <button className="rounded-full bg-[var(--orange)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em]">
                          Approve {role}
                        </button>
                      </form>
                    ))}

                    <form action={denyInternalAccount}>
                      <input type="hidden" name="email" value={account.email} />
                      <button className="rounded-full border border-red-300/30 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-100">
                        Deny
                      </button>
                    </form>
                  </div>
                </div>
              ))}

              {pending.length === 0 ? <p className="text-white/45">No pending requests.</p> : null}
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

              <select name="candidate_email" required className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-3">
                <option value="">Select candidate</option>
                {(candidates ?? []).map((candidate) => (
                  <option key={candidate.email} value={candidate.email}>
                    {candidate.full_name} — {candidate.email}
                  </option>
                ))}
              </select>

              <input name="candidate_name" required placeholder="Candidate name exactly" className="rounded-xl border border-white/10 bg-white/[0.04] p-3" />

              <select name="reviewer_email" required className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-3">
                <option value="">Select reviewer</option>
                {approvedMembers.map((member) => (
                  <option key={member.email} value={member.email}>
                    {member.full_name} — {member.email}
                  </option>
                ))}
              </select>

              <input name="reviewer_name" placeholder="Reviewer name" className="rounded-xl border border-white/10 bg-white/[0.04] p-3" />
              <input name="team_number" placeholder="Team/table number, optional" className="rounded-xl border border-whi0 bg-white/[0.04] p-3" />

              <button className="rounded-full bg-[var(--orange)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">
                Save assignment
              </button>
            </form>
          </article>
        </section>
      ) : null}

      <section className="panel overflow-x-auto rounded-[2rem] p-4">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-white/45">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Approval</th>
              <th className="p-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((member) => (
              <tr key={member.email} className="border-t border-white/10">
                <td className="p-3 font-bold">{member.full_name}</td>
                <td className="p-3 text-white/55">{member.email}</td>
                <td className="p-3 text-white/55">{member.role}</td>
                <td className="p-3 text-white/55">{member.approval_status}</td>
                <td className="p-3 text-white/55">{member.active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
