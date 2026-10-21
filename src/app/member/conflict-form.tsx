"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";
import { postMemberAction } from "@/lib/member-action";

type Submission = { kind: "editing" } | { kind: "confirming"; applicantName: string } | { kind: "pending" } | { kind: "unknown" };

export default function ConflictForm({ applications }: { applications: { id: string; name: string }[] }) {
  const router = useRouter();
  const [state, setState] = useState<Submission>({ kind: "editing" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLParagraphElement>(null);
  const reviewRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const blocked = state.kind === "pending" || state.kind === "unknown";
  useEffect(() => { if (state.kind === "confirming") headingRef.current?.focus(); }, [state.kind]);

  async function submit() {
    const form = formRef.current;
    if (!form || inFlight.current || state.kind !== "confirming") return;
    const data = new FormData(form);
    inFlight.current = true;
    setState({ kind: "pending" }); setError(""); setMessage("");
    const result = await postMemberAction({ path: "/api/member/conflicts", payload: { applicationId: data.get("applicationId"), reason: data.get("reason") } });
    inFlight.current = false;
    if (result.kind === "saved") {
      form.reset(); setState({ kind: "editing" });
      setMessage("Conflict declared. This applicant has been removed from your work queue."); router.refresh();
    } else if (result.kind === "rejected") { setState({ kind: "editing" }); setError(result.message); }
    else { setState({ kind: "unknown" }); setError("The conflict could not be confirmed. It may have been recorded. Reload to check your work queue before declaring it again."); }
  }
  function cancel() { setState({ kind: "editing" }); requestAnimationFrame(() => reviewRef.current?.focus()); }

  return <form ref={formRef} onSubmit={(event) => {
    event.preventDefault(); if (blocked || state.kind === "confirming") return;
    const id = new FormData(event.currentTarget).get("applicationId");
    const applicant = applications.find(application => application.id === id);
    if (!applicant) return;
    setError(""); setMessage(""); setState({ kind: "confirming", applicantName: applicant.name });
  }} className="rounded-xl bg-paper p-5 sm:p-6">
    <h3 className="text-lg font-semibold text-mecg-navy">Declare a conflict</h3>
    <p className="mt-1 text-sm leading-6 text-muted">This removes you from the applicant’s evaluations and decision approvals. Existing evaluation work is voided, and you cannot score this applicant afterward.</p>
    {!applications.length ? <p className="mt-4 text-sm">No applicants are available to select.</p> : <>
      <fieldset onChange={() => { if (state.kind === "confirming") setState({ kind: "editing" }); }} disabled={blocked} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium" htmlFor="conflict-applicationId">Applicant<select id="conflict-applicationId" name="applicationId" required className="select-control mt-2"><option value="">Choose an applicant</option>{applications.map(application => <option key={application.id} value={application.id}>{application.name}</option>)}</select></label>
        <label className="text-sm font-medium" htmlFor="conflict-reason">Relationship or conflict reason<input id="conflict-reason" name="reason" required maxLength={1000} className="field-control mt-2 min-w-0 w-full" /></label>
      </fieldset>
      {state.kind === "confirming" ? <section className="mt-4 border-t border-line pt-4" aria-label="Confirm conflict">
        <p ref={headingRef} tabIndex={-1} className="font-semibold">Declare a conflict for {state.applicantName}?</p>
        <p className="mt-2 text-sm leading-6">This cannot be undone. Your existing evaluation work for this applicant will be voided.</p>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="button-primary" onClick={() => void submit()}>Confirm conflict</button><button type="button" className="button-secondary" onClick={cancel}>Keep editing</button></div>
      </section> : <button ref={reviewRef} type="submit" disabled={blocked} className="button-primary mt-4">{state.kind === "pending" ? "Declaring…" : "Review conflict"}</button>}
    </>}
    <div className="mt-3 space-y-2"><OperationNotice kind="error">{error}</OperationNotice><OperationNotice kind="success">{message}</OperationNotice></div>
    {state.kind === "unknown" && <button type="button" className="button-secondary mt-3" onClick={() => window.location.reload()}>Reload to check work queue</button>}
  </form>;
}
