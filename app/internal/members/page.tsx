import React from "react";
import { createClient } from "@/lib/supabase/server";
import { requireMember, ROLE_LABELS, type MemberRole } from "@/lib/auth";
import {
  approveMembership,
  createScoringAssignment,
  denyMembership,
  grantMembershipByEmail,
  inviteMember,
  revokeMembership,
  updateMemberRole,
} from "./actions";
import { SubmitButton } from "../../apply/SubmitButton";
import { ConfirmSubmitButton } from "@/components/portal/ConfirmSubmitButton";

// Keep option values aligned with memberRoleSchema / DB enum.
const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "general_member", label: ROLE_LABELS.general_member },
  { value: "recruitment_committee", label: ROLE_LABELS.recruitment_committee },
  { value: "board", label: `${ROLE_LABELS.board} (admin)` },
];

const fieldClass =
  "rounded-xl border border-white/10 bg-[var(--navy-900)] p-3 text-sm text-white";

function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role as MemberRole] ?? role.replaceAll("_", " ");
}

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
  const [memberResult, pendingResult, cycleResult, inviteResult] = await Promise.all([
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
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string; requested_role: string | null }[], error: null }),
    isBoard
      ? supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null as { id: string } | null, error: null }),
    isBoard
      ? supabase
          .from("invite_allowlist")
          .select("id, email, role, notes, consumed_at, created_at")
          .order("created_at", { ascending: false })
          .limit(25)
      : Promise.resolve({ data: [] as { id: string; email: string; role: string; notes: string | null; consumed_at: string | null; created_at: string }[], error: null }),
  ]);

  if (memberResult.error) {
    return (
      <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-100">
        Could not load members: {memberResult.error.message}
      </p>
    );
  }

  const members = memberResult.data;
  const pending = pendingResult.data;
  const cycle = cycleResult.data;
  const invites = inviteResult.data;

  const { data: candidates, error: candidatesError } =
    isBoard && cycle
      ? await supabase
          .from("candidates")
          .select("id, full_name, email")
          .eq("cycle_id", cycle.id)
          .is("deleted_at", null)
          .order("full_name", { ascending: true })
      : { data: [] as { id: string; full_name: string | null; email: string }[], error: null };

  const canAssign =
    Boolean(cycle) && (candidates ?? []).length > 0 && (members ?? []).length > 0;

  return (
    <div className="grid gap-8">
      {params?.success ? (
        <p className="rounded-xl border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-4 text-sm text-[var(--orange-soft)]">
          {params.success}
        </p>
      ) : null}
      {params?.error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {params.error}
        </p>
      ) : null}

      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Members</p>
        <h2 className="font-display mt-5 text-5xl font-bold uppercase tracking-[-0.07em] md:text-7xl">
          Access and assignments.
        </h2>
        <p className="mt-5 text-white/58">
          {isBoard
            ? "Invite people, grant access to existing accounts, change roles, and assign scoring. Role changes and revokes are audited."
            : "Read-only roster for your role. Board manages invites and approvals."}
        </p>
      </section>

      {isBoard ? (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
            <article className="panel rounded-[2rem] p-6">
              <p className="eyebrow">Grant access now</p>
              <p className="mt-3 text-sm text-white/45">
                Use when they already signed up with a @umich.edu account. Roles match the
                database enum: Member, Recruitment Committee, or Board.
              </p>
              <form action={grantMembershipByEmail} className="mt-5 grid gap-3">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@umich.edu"
                  className={fieldClass}
                />
                <input
                  name="full_name"
                  placeholder="Full name (optional)"
                  className={fieldClass}
                />
                <select name="role" defaultValue="general_member" className={fieldClass}>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <ConfirmSubmitButton
                  pendingText="Granting..."
                  confirmMessage="Grant portal access with the selected role? This creates or restores their member record."
                >
                  Grant access
                </ConfirmSubmitButton>
              </form>
            </article>

            <article className="panel rounded-[2rem] p-6">
              <p className="eyebrow">Invite before signup</p>
              <p className="mt-3 text-sm text-white/45">
                Adds them to the allowlist. After they create an account, a pending request
                appears here — or grant them directly once the account exists.
              </p>
              <form action={inviteMember} className="mt-5 grid gap-3">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@umich.edu"
                  className={fieldClass}
                />
                <select name="role" defaultValue="general_member" className={fieldClass}>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <input name="notes" placeholder="Notes (optional)" className={fieldClass} />
                <SubmitButton pendingText="Saving...">Save invite</SubmitButton>
              </form>

              <div className="mt-6 grid gap-2">
                {(invites ?? []).slice(0, 8).map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
                  >
                    <p className="font-bold">{invite.email}</p>
                    <p className="text-white/45">
                      {roleLabel(invite.role)}
                      {invite.consumed_at ? " · signed up" : " · waiting"}
                      {invite.notes ? ` · ${invite.notes}` : ""}
                    </p>
                  </div>
                ))}
                {(invites ?? []).length === 0 ? (
                  <p className="text-sm text-white/45">No invites yet.</p>
                ) : null}
              </div>
            </article>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <article className="panel rounded-[2rem] p-6">
              <p className="eyebrow">Pending Requests</p>
              <div className="mt-5 grid gap-3">
                {(pending ?? []).map((req) => (
                  <div key={req.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="font-bold">{req.full_name}</p>
                    <p className="text-sm text-white/45">{req.email}</p>
                    <p className="mt-1 text-sm text-white/45">
                      Requested: {roleLabel(req.requested_role)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {ROLE_OPTIONS.map((role) => (
                        <form key={role.value} action={approveMembership}>
                          <input type="hidden" name="request_id" value={req.id} />
                          <input type="hidden" name="role" value={role.value} />
                          <ConfirmSubmitButton
                            pendingText="Approving..."
                            confirmMessage={`Approve ${req.full_name ?? req.email} as ${role.label}?`}
                          >
                            Approve {role.label}
                          </ConfirmSubmitButton>
                        </form>
                      ))}

                      <form action={denyMembership}>
                        <input type="hidden" name="request_id" value={req.id} />
                        <ConfirmSubmitButton
                          pendingText="Denying..."
                          confirmMessage={`Deny access for ${req.full_name ?? req.email}? They will stay out of the portal until re-approved.`}
                          className="focus-ring cursor-pointer rounded-full border border-red-300/40 bg-red-400/15 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-red-100 transition hover:bg-red-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Deny
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                ))}

                {(pending ?? []).length === 0 ? (
                  <p className="text-white/45">No pending requests.</p>
                ) : null}
              </div>
            </article>

            <article className="panel rounded-[2rem] p-6">
              <p className="eyebrow">Create Scoring Assignment</p>
              {!cycle ? (
                <p className="mt-5 text-sm text-white/45">
                  No active recruitment cycle — assignments cannot be created until one is
                  active.
                </p>
              ) : candidatesError ? (
                <p className="mt-5 text-sm text-red-100">
                  Could not load candidates: {candidatesError.message}
                </p>
              ) : !canAssign ? (
                <p className="mt-5 text-sm text-white/45">
                  Need at least one candidate in the active cycle and one member on the
                  roster before assigning scorers.
                </p>
              ) : (
                <form action={createScoringAssignment} className="mt-5 grid gap-3">
                  <select name="stage" required className={fieldClass}>
                    <option value="speed_dating">Speed Dating</option>
                    <option value="group_case">Group Case</option>
                    <option value="final_round">Final Round (interview)</option>
                  </select>

                  <select name="candidate_id" required className={fieldClass}>
                    <option value="">Select candidate</option>
                    {(candidates ?? []).map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.full_name} — {candidate.email}
                      </option>
                    ))}
                  </select>

                  <select name="reviewer_id" required className={fieldClass}>
                    <option value="">Select reviewer</option>
                    {(members ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} — {m.email}
                      </option>
                    ))}
                  </select>

                  <input
                    name="team_label"
                    placeholder="Team/table label, optional"
                    className={fieldClass}
                  />

                  <SubmitButton pendingText="Saving...">Save assignment</SubmitButton>
                </form>
              )}
            </article>
          </section>
        </>
      ) : null}

      <section className="panel overflow-x-auto rounded-[2rem] p-4">
        {(members ?? []).length === 0 ? (
          <p className="p-4 text-white/45">No active members on the roster.</p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-white/45">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                {isBoard ? <th className="p-3">Manage</th> : null}
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.id} className="border-t border-white/10">
                  <td className="p-3 font-bold">{m.full_name}</td>
                  <td className="p-3 text-white/55">{m.email}</td>
                  <td className="p-3 text-white/55">{ROLE_LABELS[m.role]}</td>
                  {isBoard ? (
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={updateMemberRole} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="member_id" value={m.id} />
                          <select
                            name="role"
                            defaultValue={m.role}
                            className="rounded-lg border border-white/10 bg-[var(--navy-900)] px-2 py-2 text-xs"
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                          <ConfirmSubmitButton
                            pendingText="Saving..."
                            confirmMessage={`Change ${m.full_name ?? m.email}'s role? Role changes are audited.`}
                          >
                            Update role
                          </ConfirmSubmitButton>
                        </form>
                        {m.id !== member.id ? (
                          <form action={revokeMembership}>
                            <input type="hidden" name="member_id" value={m.id} />
                            <ConfirmSubmitButton
                              pendingText="Revoking..."
                              confirmMessage={`Revoke portal access for ${m.full_name ?? m.email}? They lose internal access immediately. History is kept (soft revoke).`}
                              className="focus-ring cursor-pointer rounded-full border border-red-300/40 bg-red-400/15 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-red-100 transition hover:bg-red-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Revoke
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
