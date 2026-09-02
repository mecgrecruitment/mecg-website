import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cycleStatusLabel } from "@/lib/labels";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import SectionLabel from "@/components/section-label";
import VoteForm from "./vote-form";

export const metadata: Metadata = { title: "Hash" };

export default async function MemberHashPage() {
  const user = await requireMember();
  const cycleMembership = user.memberships.find((membership) => ["MEMBER", "BOARD", "PANEL", "OWNER", "RECRUITMENT_COMMITTEE"].includes(membership.role));
  if (!cycleMembership) return null;
  const { cycleId, cycle } = cycleMembership;

  const header = (
    <>
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)}`}
        title="Hash"
        description="Hash is the members' vote on each applicant. Every active member gets one vote, and the result decides the outcome."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/member/hash" />
    </>
  );

  if (cycle.status !== "DECISION_LOCK") {
    return (
      <main className="workspace-stack mx-auto flex max-w-4xl flex-col">
        {header}
        <section>
          <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-sm text-mecg-navy/55">
            Voting is not open yet. It opens once interviews are done and the board moves the cycle into voting and decisions.
          </p>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  // The quorum comes from the cycle row, not from rush.hash_tally. The tally is
  // board-only on purpose: a member who could see an applicant sitting at
  // 3 yes / 9 no would know how to vote, which is the whole thing a secret
  // ballot is meant to prevent. The cycle row carries the threshold and no counts.
  const [{ data: applicants, error: applicantsError }, { data: votes, error: votesError }, { data: cycleRow, error: cycleError }] = await Promise.all([
    supabase.rpc("hash_ballot", { target_cycle_id: cycleId }),
    supabase.from("hash_votes").select("application_id,vote,note").eq("cycle_id", cycleId).eq("voter_id", user.id),
    supabase.from("rush_cycles").select("hash_quorum").eq("id", cycleId).single(),
  ]);
  if (applicantsError) throw applicantsError;
  if (votesError) throw votesError;
  if (cycleError) throw cycleError;
  const quorum = cycleRow?.hash_quorum ?? 0;
  const myVotes = new Map((votes ?? []).map((vote) => [vote.application_id, vote]));
  const applicantList = (applicants ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="workspace-stack mx-auto flex max-w-4xl flex-col">
      {header}
      <section>
        <SectionLabel number="01">How it works</SectionLabel>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-mecg-navy/70">
          {quorum
            ? `An applicant's vote only counts once at least ${quorum} members have voted on them. Past that, more Yes than No means an offer; anything else does not. Unsure counts toward reaching ${quorum} but not toward either side. You can change your vote until the board applies the result.`
            : "An applicant's vote only counts once enough members have voted on them. Past that, more Yes than No means an offer; anything else does not. Unsure counts toward reaching that number but not toward either side. You can change your vote until the board applies the result."}
        </p>
        <p className="mt-2 max-w-2xl text-[13px] leading-5 text-mecg-navy/55">
          You cannot see how anyone else voted or where the count stands.
        </p>
      </section>

      <section>
        <SectionLabel number="02">Your votes</SectionLabel>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">
          {applicantList.length ? `${applicantList.length} applicant${applicantList.length === 1 ? "" : "s"} to vote on` : "Nobody to vote on"}
        </h2>
        <div className="mt-3.5 flex flex-col gap-4">
          {applicantList.map((applicant) => {
            const existing = myVotes.get(applicant.id);
            return (
              <article key={applicant.id} className="rounded-2xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-6">
                <h3 className="text-lg font-semibold text-mecg-navy">{applicant.name}</h3>
                <p className="mt-1 text-[12px] text-mecg-navy/55">{existing ? "You have voted. Saving again replaces it." : "You have not voted on this applicant yet."}</p>
                <div className="mt-4">
                  <VoteForm
                    applicationId={applicant.id}
                    applicantName={applicant.name}
                    initialVote={existing?.vote ?? ""}
                    initialNote={existing?.note ?? ""}
                  />
                </div>
              </article>
            );
          })}
          {!applicantList.length && (
            <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-sm text-mecg-navy/55">
              No applicants are up for a vote right now. Anyone you have declared a conflict on stays off this list.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
