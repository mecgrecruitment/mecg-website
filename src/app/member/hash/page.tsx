import { selectWorkspaceMembership } from "@/lib/workspace-cycle";
import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { applicationStatusLabel, cycleStatusLabel, hashStageLabel } from "@/lib/labels";
import { canVoteInStage, currentHashStage, HASH_STAGE_RULES } from "@/lib/hash-tally";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { canonicalMajor } from "@/lib/major";
import { CLASS_YEAR_LABELS, type ClassYear } from "@/lib/workflow";
import HashBallot from "./hash-ballot";

export const metadata: Metadata = { title: "Hash" };

export default async function MemberHashPage() {
  const user = await requireMember();
  const cycleMembership = await selectWorkspaceMembership(user, ["MEMBER", "BOARD", "PANEL", "OWNER", "RECRUITMENT_COMMITTEE"]);
  if (!cycleMembership) return null;
  const { cycleId, cycle } = cycleMembership;
  const supabase = await createClient();
  // The quorum comes from the cycle row, not from rush.hash_tally. The tally is
  // board-only on purpose: a member who could see an applicant sitting at
  // 3 yes / 9 no would know how to vote, which is the whole thing a secret
  // ballot is meant to prevent. The cycle row carries the threshold and no counts.
  const { data: cycleRow, error: cycleError } = await supabase.from("rush_cycles").select("hash_stage,hash_quorum,status,hash_presenting_application_id").eq("id", cycleId).single();
  if (cycleError) throw cycleError;
  const stage = currentHashStage(cycleRow);
  const stageName = stage ? `${hashStageLabel(stage)} hash` : "Hash";

  const header = (
    <>
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)}`}
        title={stageName}
        description="Hash is the members' vote on each applicant. Every eligible member gets one vote, and the result decides where the applicant goes next."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/member/hash" />
    </>
  );

  if (!stage || !canVoteInStage(cycleMembership.role, stage)) {
    return (
      <main className="workspace-stack mx-auto flex max-w-4xl flex-col">
        {header}
        <section>
          <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-sm text-mecg-navy/55">
            {stage
              ? `The ${hashStageLabel(stage)} hash is a board and recruitment committee vote.`
              : "Voting is not open yet. It opens when the board opens a stage vote or moves the cycle into voting and decisions."}
          </p>
        </section>
      </main>
    );
  }

  const [{ data: applicants, error: applicantsError }, { data: votes, error: votesError }] = await Promise.all([
    supabase.rpc("hash_ballot", { target_cycle_id: cycleId }),
    supabase.from("hash_votes").select("application_id,vote,note").eq("cycle_id", cycleId).eq("voter_id", user.id).eq("stage", stage),
  ]);
  if (applicantsError) throw applicantsError;
  if (votesError) throw votesError;
  const quorum = cycleRow.hash_quorum ?? 0;
  const outcomeCopy = stage === "FINAL"
    ? "60% Yes means an offer; anything else does not"
    : `YES sends them to ${applicationStatusLabel(HASH_STAGE_RULES[stage].pass)}; anything else ends their application`;
  const applicantList = (applicants ?? []).map(({ id, name, major, class_year }) => ({
    id,
    name,
    meta: [major ? canonicalMajor(major) : "", class_year ? CLASS_YEAR_LABELS[class_year as ClassYear] ?? class_year : ""].filter(Boolean).join(" · "),
  })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="workspace-stack mx-auto flex max-w-4xl flex-col">
      {header}
      <section>
        <p className="max-w-2xl text-[14px] leading-6 text-mecg-navy/70">
          {quorum
            ? `An applicant's vote counts once at least ${quorum} members have voted on them: ${outcomeCopy}, and Unsure counts toward ${quorum} but not as a Yes.`
            : `An applicant's vote counts once enough members have voted on them: ${outcomeCopy}, and Unsure counts toward that number but not as a Yes.`}
          {" "}Every tap saves on its own, you can change it until the board applies the result, and nobody can see how anyone else voted or where the count stands.
        </p>
      </section>
      <HashBallot cycleId={cycleId} applicants={applicantList} votes={votes ?? []} presentingId={cycleRow.hash_presenting_application_id} />
    </main>
  );
}
