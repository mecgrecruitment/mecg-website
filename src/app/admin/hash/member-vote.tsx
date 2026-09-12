import StatusPill from "@/components/status-pill";
import { hashOutcome } from "@/lib/hash-tally";

export type HashTallyRow = {
  application_id: string;
  yes_count: number;
  no_count: number;
  unsure_count: number;
  total_votes: number;
  quorum: number;
};

// The counts and the rule that reads them belong together, and every layout
// (decision queue, stage panel) shows the same cell, so the rule is written
// once here. A stage vote passes people forward rather than offering, so the
// pill labels are a prop.
export function MemberVote({ tally, labels = { pass: "Offer", fail: "No offer" } }: { tally: HashTallyRow | undefined; labels?: { pass: string; fail: string } }) {
  if (!tally) return <span className="text-[12px] text-mecg-navy/55">—</span>;
  const outcome = hashOutcome(tally.quorum, tally.yes_count, tally.no_count, tally.total_votes);
  return (
    <div className="flex flex-col items-start gap-1.5">
      <p className="text-[12px] text-mecg-navy/70">
        <span className="tabular">{tally.yes_count}</span> yes · <span className="tabular">{tally.no_count}</span> no · <span className="tabular">{tally.unsure_count}</span> unsure
      </p>
      <StatusPill tone={outcome === "OFFER" ? "navy" : "neutral"}>{outcome === "OFFER" ? labels.pass : outcome === "REJECT" ? labels.fail : "Not enough votes"}</StatusPill>
      {outcome === "PENDING" && <p className="text-[12px] text-mecg-navy/55"><span className="tabular">{tally.total_votes}/{tally.quorum}</span> votes so far</p>}
    </div>
  );
}

// Notes arrive without an author and in an order that cannot be lined up
// against vote timestamps, so they are rendered exactly as they arrive.
export function MemberNotes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-mecg-navy">What members wrote</h3>
      <p className="mt-0.5 text-[12px] text-mecg-navy/55">Notes are shown without names.</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {notes.slice(0, 10).map((note, index) => (
          <li key={`${index}-${note}`} className="text-[12px] leading-5 text-mecg-navy/70">{note}</li>
        ))}
      </ul>
      {notes.length > 10 && <p className="mt-1.5 text-[12px] text-mecg-navy/55">and {notes.length - 10} more</p>}
    </div>
  );
}
