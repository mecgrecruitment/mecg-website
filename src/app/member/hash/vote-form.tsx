"use client";

import { useState } from "react";
import { useAction } from "@/lib/use-action";
import OperationNotice from "@/components/operation-notice";
import SegmentedControl from "@/components/segmented-control";

const NOTE_LIMIT = 1000;

const CHOICES = [
  { value: "YES", label: "Yes" },
  { value: "UNSURE", label: "Unsure" },
  { value: "NO", label: "No" },
];

export default function VoteForm({
  applicationId,
  applicantName,
  initialVote,
  initialNote,
}: {
  applicationId: string;
  applicantName: string;
  initialVote: string;
  initialNote: string;
}) {
  const { pending, error, success, run } = useAction("/api/member/hash-votes", "Could not save your vote. Check your connection and try again.");
  const [vote, setVote] = useState(initialVote);
  const [note, setNote] = useState(initialNote);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run({ applicationId, vote, note }, { successMessage: "Your vote is saved.", fallbackError: "Could not save your vote" });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <SegmentedControl name={`Your vote on ${applicantName}`} options={CHOICES} value={vote} onChange={setVote} />
      <div className="text-sm font-semibold text-mecg-navy">
        <span className="flex items-baseline justify-between gap-3">
          <label htmlFor={`hash-note-${applicationId}`}>Note (optional)</label>
          <span className="tabular text-[12px] font-medium text-mecg-navy/60">{note.length}/{NOTE_LIMIT}</span>
        </span>
        <textarea
          id={`hash-note-${applicationId}`}
          maxLength={NOTE_LIMIT}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={pending}
          placeholder="Anything the board should know. Only the board reads this."
          className="field-control mt-2 min-h-20 py-3 text-[14px] font-normal leading-6 text-mecg-navy placeholder:text-mecg-navy/35 disabled:opacity-60"
        />
      </div>
      <button type="submit" disabled={pending || !vote} className="button-primary self-start">{pending ? "Saving…" : "Save vote"}</button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </form>
  );
}
