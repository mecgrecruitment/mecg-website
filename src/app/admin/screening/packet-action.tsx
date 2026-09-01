"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction } from "@/lib/use-action";
import OperationNotice from "@/components/operation-notice";

export default function PacketAction({ cycleId, packetId, status, responses }: { cycleId: string; packetId: string; status: string; responses: Array<{ question?: string; answer?: string }> }) {
  const { pending, error, success, run, setError } = useAction("/api/admin/screening");
  const [answers, setAnswers] = useState(responses.map((response) => response.answer ?? ""));
  const dirty = useMemo(() => answers.some((answer, index) => answer !== (responses[index]?.answer ?? "")), [answers, responses]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  async function decide(approved: boolean) {
    if (dirty) {
      setError("Save or discard your redaction changes before changing this packet’s review status.");
      return;
    }
    await run(
      { cycleId, action: "APPROVE_PACKET", packetId, approved },
      { successMessage: approved ? "Blind packet approved." : "Packet returned for redaction.", fallbackError: "Could not update packet" },
    );
  }
  async function saveRedaction() {
    const content = { responses: responses.map((response, index) => ({ question: response.question ?? "", answer: answers[index] ?? "" })) };
    await run(
      { cycleId, action: "UPDATE_PACKET", packetId, content },
      { successMessage: "Redaction saved. The packet must be approved again.", fallbackError: "Could not save redaction" },
    );
  }
  return (
    <div className="mt-4 space-y-3">
      <details className="group rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
        <summary className="button-secondary w-fit cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
          Edit redacted answers
        </summary>
        <div className="mt-3 space-y-3">
          {responses.map((response, index) => (
            <label key={index} className="block text-xs font-medium">
              {response.question}
              <textarea
                value={answers[index]}
                onChange={(event) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))}
                className="mt-1 min-h-24 w-full rounded-xl bg-mecg-navy/[0.035] px-3 py-2 text-sm font-normal shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
              />
            </label>
          ))}
          {dirty && <p className="text-xs font-medium text-mecg-orange-ink">Unsaved redaction changes</p>}
          <button type="button" disabled={pending || !dirty} onClick={() => void saveRedaction()} className="button-secondary">{pending ? "Saving…" : "Save redaction"}</button>
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        <button disabled={pending || dirty || status === "APPROVED"} onClick={() => void decide(true)} className="button-primary">{pending ? "Working…" : "Approve blind packet"}</button>
        <button disabled={pending || dirty || status === "REJECTED"} onClick={() => void decide(false)} className="button-secondary">Reject for redaction</button>
      </div>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </div>
  );
}
