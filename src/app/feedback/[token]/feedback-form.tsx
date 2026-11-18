"use client";
// design-owner: client:mecg because the public portal follows docs/DESIGN.md tokens and PortalShell patterns

import { useId, useRef, useState } from "react";
import FormField from "@/components/form-field";
import { ATTRIBUTION_LIMIT, QUOTE_LIMIT, SCOPE_LIMIT, parseFeedbackInput, rehireAnswers, rehireLabels } from "@/lib/engagement/closeout";

const ratings = [
  [1, "Very dissatisfied"], [2, "Dissatisfied"], [3, "Neutral"], [4, "Satisfied"], [5, "Very satisfied"],
] as const;
const choice = "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-wash px-4 text-sm font-normal text-mecg-navy inset-ring inset-ring-line has-checked:bg-white has-checked:inset-ring-2 has-checked:inset-ring-mecg-navy";

export default function ClientFeedbackForm({ token, expiresLabel }: { token: string; expiresLabel: string }) {
  const id = useId();
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const [askingPermission, setAskingPermission] = useState(false);
  const locked = useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const data = new FormData(event.currentTarget);
    const parsed = parseFeedbackInput({
      satisfaction: Number(data.get("satisfaction")),
      wouldRehire: String(data.get("wouldRehire") ?? ""),
      quote: String(data.get("quote") ?? ""),
      attribution: String(data.get("attribution") ?? ""),
      quotePermission: data.get("quotePermission") === "on",
      logoPermission: data.get("logoPermission") === "on",
      permissionScope: String(data.get("permissionScope") ?? ""),
    });
    if (!parsed.ok) { setError(parsed.error); return; }
    locked.current = true; setStatus("sending"); setError("");
    try {
      const response = await fetch(`/api/feedback/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.value) });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "We could not confirm your feedback. Your answers are still here; try again.");
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setError("We could not confirm your feedback. Your answers are still here; try again. If it already went through, this page will say the link was used.");
      setStatus("idle");
    } finally { locked.current = false; }
  }

  if (status === "sent") {
    return <div className="rounded-xl bg-success-wash p-5 text-success" role="status">
      <p className="font-semibold">Thank you. Your feedback was received.</p>
      <p className="mt-1 text-sm">The project team will read it. We use a quote or your logo only as you allowed here, and only after checking with you if anything is unclear.</p>
    </div>;
  }

  const pending = status === "sending";
  return <form onSubmit={submit} className="space-y-6" noValidate>
    <fieldset className="space-y-3" disabled={pending}>
      <legend className="text-sm font-semibold text-mecg-navy">How satisfied are you with the project overall?</legend>
      <div className="grid gap-2 sm:grid-cols-5">
        {ratings.map(([value, label]) => <label key={value} className={choice}>
          <input type="radio" name="satisfaction" value={value} required className="size-4 accent-mecg-navy" />
          <span><span className="tabular font-semibold">{value}</span> <span className="sm:block sm:text-xs">{label}</span></span>
        </label>)}
      </div>
    </fieldset>

    <fieldset className="space-y-3" disabled={pending}>
      <legend className="text-sm font-semibold text-mecg-navy">Would you work with MECG again?</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {rehireAnswers.map((answer) => <label key={answer} className={choice}>
          <input type="radio" name="wouldRehire" value={answer} required className="size-4 accent-mecg-navy" />{rehireLabels[answer]}
        </label>)}
      </div>
    </fieldset>

    <div>
      <label htmlFor={`${id}-quote`} className="block text-sm font-semibold text-mecg-navy">Anything you’d like to tell the team? · Optional</label>
      <textarea id={`${id}-quote`} name="quote" maxLength={QUOTE_LIMIT} disabled={pending} aria-describedby={`${id}-quote-hint`} className="field-control mt-2 min-h-28 py-3 text-sm" />
      <p id={`${id}-quote-hint`} className="mt-2 text-xs leading-5 text-muted">If you allow us to quote you, we use these words.</p>
    </div>

    <fieldset className="space-y-3 rounded-xl bg-wash p-4" disabled={pending}>
      <legend className="sr-only">Permission to use a quote or logo</legend>
      <p className="text-sm font-semibold text-mecg-navy">Permission · Optional</p>
      <p className="text-xs leading-5 text-muted">Leave these unchecked and nothing is shared outside MECG. You can withdraw permission later by contacting your project lead.</p>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="quotePermission" className="size-4 accent-mecg-navy" onChange={(event) => setAskingPermission(event.currentTarget.checked || !!event.currentTarget.form?.querySelector<HTMLInputElement>("input[name=logoPermission]")?.checked)} />MECG may quote what I wrote above</label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="logoPermission" className="size-4 accent-mecg-navy" onChange={(event) => setAskingPermission(event.currentTarget.checked || !!event.currentTarget.form?.querySelector<HTMLInputElement>("input[name=quotePermission]")?.checked)} />MECG may show our organization’s logo</label>
      {askingPermission && <>
        <div>
          <label htmlFor={`${id}-scope`} className="block text-sm font-semibold text-mecg-navy">Where and how may we use it? · Required</label>
          <textarea id={`${id}-scope`} name="permissionScope" maxLength={SCOPE_LIMIT} disabled={pending} placeholder="For example: MECG website and recruiting slides, no paid ads" className="field-control mt-2 min-h-20 py-3 text-sm" />
        </div>
        <FormField id={`${id}-attribution`} name="attribution" label="How should we credit you? · Optional" hint="Name and title, title only, or leave blank for anonymous." maxLength={ATTRIBUTION_LIMIT} disabled={pending} />
      </>}
    </fieldset>

    {error && <p role="alert" className="text-sm leading-6 text-danger">{error}</p>}
    <button className="button-primary w-full sm:w-auto" disabled={pending}>{pending ? "Sending…" : "Send feedback"}</button>
    <p className="text-xs leading-5 text-muted">This link works once and expires {expiresLabel}.</p>
  </form>;
}
