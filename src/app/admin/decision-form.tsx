"use client";

import Link from "@/components/workspace-link";
import { releaseEvidenceHref } from "@/lib/release-evidence";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "@/lib/use-action";
import { detroitDateTimeToIso, formatDetroitDateTime } from "@/lib/detroit-date-time";
import { formatEasternDateTime } from "@/lib/date-time";
import { decisionOutcomeLabel } from "@/lib/labels";
import OperationNotice from "@/components/operation-notice";
import { parseReleasePreflight, parseReleaseReport, releaseSnapshot, labelReleaseItems, filterReleaseItems, type ReleaseViewFilters, RELEASE_REASONS, type LabeledReleaseItem, type ReleaseReport } from "@/lib/decision-release";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";

const DECISION_OUTCOMES = ["OFFER", "WAITLIST", "REJECT", "PROCEDURAL_REVIEW"] as const;

export default function DecisionForm({ cycleId, applicationId }: { cycleId: string; applicationId: string }) {
  const { pending, error, success, run } = useAction("/api/admin/decisions", "Could not create decision. Check your connection and try again.");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(
      { action: "CREATE", cycleId, applicationId, outcome: data.get("outcome"), reason: data.get("reason") },
      { successMessage: "Decision recommendation created.", fallbackError: "Could not create decision" },
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={`outcome-${applicationId}`}>
        Decision outcome
      </label>
      <select id={`outcome-${applicationId}`} name="outcome" disabled={pending} className="select-control text-xs">
        {/* The value is set explicitly: without it the option's visible text is
            what the form posts, so humanizing the label would have changed the
            outcome sent to the server. */}
        {DECISION_OUTCOMES.map((outcome) => (
          <option key={outcome} value={outcome}>{decisionOutcomeLabel(outcome)}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`reason-${applicationId}`}>Evidence-based reason</label>
      <input id={`reason-${applicationId}`} name="reason" required disabled={pending} placeholder="Evidence-based reason" className="operation-control min-h-11 w-full rounded-xl bg-wash px-3 text-xs inset-ring inset-ring-line-strong outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)] disabled:opacity-60" />
      <button type="submit" disabled={pending} className="button-primary self-start text-xs">{pending ? "Creating…" : "Recommend"}</button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </form>
  );
}

export function ApprovalButton({ decisionId }: { decisionId: string }) {
  const { pending, error, success, run } = useAction("/api/admin/decisions", "Could not approve");
  async function approve() {
    if (pending || !window.confirm("Approve this recommendation? A second approval locks it for release.")) return;
    await run({ action: "APPROVE", decisionId }, { successMessage: "Approval recorded.", fallbackError: "Could not approve" });
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" disabled={pending} onClick={approve} className="button-secondary text-xs">{pending ? "Approving…" : "Approve"}</button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </div>
  );
}

export function PreviewForm({ decisionId, cycleId, current }: { decisionId: string; cycleId: string; current?: string | null }) {
  const { pending, error, success, run } = useAction("/api/admin/decisions", "Could not save preview. Check your connection and try again.");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(
      { action: "PREVIEW", cycleId, decisionId, preview: data.get("preview") },
      { successMessage: "Release preview saved.", fallbackError: "Could not save preview" },
    );
  }

  return (
    <form className="flex flex-col gap-1.5" onSubmit={submit}>
      <label className="sr-only" htmlFor={`preview-${decisionId}`}>Applicant email preview</label>
      <textarea id={`preview-${decisionId}`} name="preview" disabled={pending} defaultValue={current ?? ""} placeholder="Email preview. Release still requires two approvals." className="min-h-24 w-full rounded-xl bg-wash p-2.5 text-xs inset-ring inset-ring-line-strong outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)] disabled:opacity-60" />
      <button type="submit" disabled={pending} className="button-secondary self-start text-xs">
        {pending ? "Saving…" : "Save preview"}
      </button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </form>
  );
}

export function ReleaseButton({ decisionId }: { decisionId: string }) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  async function release() {
    if (busy.current || uncertain || success || !window.confirm("Release this outcome to the applicant now? This cannot be undone.")) return;
    busy.current = true; setPending(true); setError("");
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/admin/decisions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "RELEASE", decisionId }),
      }, 15_000, authorizedFetch);
      if (!response.ok && response.status < 500 && response.status !== 408) {
        setError(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Could not release this outcome. Review its current state before trying again.");
        return;
      }
      if (!response.ok || !body || typeof body !== "object" || !("released" in body) || body.released !== true
        || !("decisionId" in body) || body.decisionId !== decisionId
        || !("notified" in body) || typeof body.notified !== "boolean" || !("queued" in body) || typeof body.queued !== "boolean") {
        setUncertain(true); return;
      }
      setSuccess(body.notified ? "Outcome released to the applicant; notification delivered." : body.queued ? "Outcome released to the applicant. Notification is queued." : "Outcome released to the applicant. Notification delivery needs review.");
      router.refresh();
    } catch { setUncertain(true); }
    finally { busy.current = false; setPending(false); requestAnimationFrame(() => resultRef.current?.focus()); }
  }
  return <div className="flex flex-col items-start gap-2">
    <button type="button" disabled={pending || uncertain || !!success} onClick={release} className="button-primary text-xs">{pending ? "Releasing…" : "Release outcome"}</button>
    <div ref={resultRef} tabIndex={-1} aria-label="Outcome release result">
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
      {uncertain && <>
        <OperationNotice kind="info">Release could not be confirmed. This outcome may already be released. Reload the current page and check its decision status before another release review. This button stays locked to prevent an accidental duplicate.</OperationNotice>
        <button type="button" className="button-secondary mt-2" onClick={() => window.location.reload()}>Reload current decision status</button>
      </>}
    </div>
  </div>;
}

// Preflight is advisory until the server checks the exact reviewed snapshot.
export function ReleaseAllButton({ cycleId, lockedCount }: { cycleId: string; lockedCount: number }) {
  const filterId = useId();
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [review, setReview] = useState<LabeledReleaseItem[] | null>(null);
  const [filters, setFilters] = useState<ReleaseViewFilters>({ query: "", eligibility: "ALL", outcome: "ALL" });
  const [report, setReport] = useState<(Omit<ReleaseReport, "items"> & { items: LabeledReleaseItem[] }) | null>(null);

  const reviewTriggerRef = useRef<HTMLButtonElement>(null);
  const reviewRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const focusAfterRelease = useRef(false);

  async function requestReview() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFilters({ query: "", eligibility: "ALL", outcome: "ALL" });
    setError("");
    setReview(null);
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/admin/decisions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RELEASE_PREFLIGHT", cycleId }),
      }, 15_000, authorizedFetch);
      if (!response.ok) { setError("Could not check release readiness. Refresh your session and try again."); return; }
      const items = parseReleasePreflight(body);
      if (!items) { setError("Release readiness could not be verified. Reload the board before trying again."); return; }
      const labeled = labelReleaseItems(items, body);
      if (!labeled) { setError("Applicant codes could not be verified. Reload the board before trying again."); return; }
      setReview(labeled);
    } catch {
      setError("Could not check release readiness. Check your connection and try again.");
    } finally { busy.current = false; setPending(false); }
  }

  async function releaseReviewed() {
    if (busy.current || !review) return;
    busy.current = true;
    setPending(true);
    setError("");
    setReport(null);
    focusAfterRelease.current = true;
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/admin/decisions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RELEASE_ALL", cycleId, snapshot: releaseSnapshot(review) }),
      }, 15_000, authorizedFetch);
      if (!response.ok) {
        setReview(null);
        setError(response.status === 409
          ? "The cohort, outcomes or readiness changed. Review the current cohort and confirm again."
          : "Release could not be confirmed. Refresh the board and review current outcomes before retrying.");
        router.refresh();
        return;
      }
      const result = parseReleaseReport(body);
      if (!result) {
        setReview(null);
        setError("The release response could not be verified. Refresh the board before retrying; some outcomes may already be released.");
        router.refresh();
        return;
      }
      const labeled = labelReleaseItems(result.items, body);
      if (!labeled) {
        setReview(null);
        setError("The release result could not be verified. Refresh the board before retrying.");
        router.refresh();
        return;
      }
      setReport({ ...result, items: labeled });
      setReview(null);
      router.refresh();
    } catch {
      setReview(null);
      setError("The release result is unknown. Refresh the board before retrying; some outcomes may already be released.");
      router.refresh();
    } finally { busy.current = false; setPending(false); }
  }

  function itemList(items: LabeledReleaseItem[]) {
    return <ul className="divide-y divide-line border-y border-line">
      {items.map((item) => <li key={item.decisionId} className="py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href={withWorkspaceCycle(`/admin/applications/${encodeURIComponent(item.applicationId)}`, cycleId)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
            {item.applicantLabel} · Open dossier
          </Link>
          <span>{decisionOutcomeLabel(item.outcome)}</span>
          <span className="font-semibold">{item.reasonCode ? "Blocked" : "Eligible"}</span>
        </div>
        {item.reasonCode && <p className="max-w-2xl leading-6 text-muted">{RELEASE_REASONS[item.reasonCode]}</p>}
        {item.reasonCode === "EVIDENCE_NOT_READY" && <Link href={releaseEvidenceHref(item.applicationId, cycleId)} className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Inspect missing evidence for {item.applicantLabel}</Link>}
      </li>)}
    </ul>;
  }

  useEffect(() => {
    if (pending) return;
    if (review) reviewRef.current?.focus();
    else if (focusAfterRelease.current) {
      focusAfterRelease.current = false;
      if (report) resultRef.current?.focus();
      else reviewTriggerRef.current?.focus();
    }
  }, [pending, review, report]);

  const eligible = review?.filter((item) => item.reasonCode === null) ?? [];
  const blocked = review?.filter((item) => item.reasonCode !== null) ?? [];
  const visibleItems = filterReleaseItems(review ?? [], filters);
  if (!lockedCount && !review && !report && !error) return null;
  return <div className="flex w-full flex-col items-start gap-3 text-sm">
    <button ref={reviewTriggerRef} type="button" disabled={pending} onClick={() => void requestReview()} className="button-secondary text-sm">
      {pending ? "Checking release…" : report ? "Review remaining outcomes" : `Review ${lockedCount} locked outcome${lockedCount === 1 ? "" : "s"}`}
    </button>
    <OperationNotice kind="error">{error}</OperationNotice>
    {review && <section ref={reviewRef} tabIndex={-1} aria-label="Confirm release cohort" className="w-full border border-line p-4 sm:p-5">
      <h3 className="text-base font-semibold">Review outcomes before release</h3>
      <p className="mt-2 leading-6">{review.length} locked outcomes: {eligible.length} eligible, {blocked.length} blocked. Only the eligible outcomes below will be released. Applicant-visible release cannot be undone.</p>
      <p className="my-3 leading-6 text-muted">Each row identifies the applicant code and outcome. The server checks this cohort again before releasing; queued emails are tracked separately in the delivery log.</p>
      <dl className="my-4 flex flex-wrap gap-x-6 gap-y-2" aria-label="Full cohort outcomes">
        {DECISION_OUTCOMES.map((outcome) => <div key={outcome}><dt className="text-muted">{decisionOutcomeLabel(outcome)}</dt><dd className="font-semibold tabular-nums">{review.filter((item) => item.outcome === outcome).length}</dd></div>)}
      </dl>
      <div className="my-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">Applicant code<input type="search" value={filters.query} maxLength={100} disabled={pending} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-white px-3 text-mecg-navy focus:outline-2 focus:outline-offset-2 focus:outline-mecg-navy" /></label>
        <div><label htmlFor={`${filterId}-eligibility`} className="text-sm font-medium">Release eligibility</label><select id={`${filterId}-eligibility`} value={filters.eligibility} disabled={pending} onChange={(event) => { const eligibility = event.target.value; if (eligibility === "ALL" || eligibility === "ELIGIBLE" || eligibility === "BLOCKED") setFilters((current) => ({ ...current, eligibility })); }} className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-white px-3 text-mecg-navy focus:outline-2 focus:outline-offset-2 focus:outline-mecg-navy"><option value="ALL">All eligibility</option><option value="ELIGIBLE">Eligible</option><option value="BLOCKED">Blocked</option></select></div>
        <div><label htmlFor={`${filterId}-outcome`} className="text-sm font-medium">Outcome</label><select id={`${filterId}-outcome`} value={filters.outcome} disabled={pending} onChange={(event) => { const outcome = event.target.value; if (outcome === "ALL" || outcome === "OFFER" || outcome === "WAITLIST" || outcome === "REJECT" || outcome === "PROCEDURAL_REVIEW") setFilters((current) => ({ ...current, outcome })); }} className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-white px-3 text-mecg-navy focus:outline-2 focus:outline-offset-2 focus:outline-mecg-navy"><option value="ALL">All outcomes</option>{DECISION_OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{decisionOutcomeLabel(outcome)}</option>)}</select></div>
      </div>
      <p role="status" className="leading-6">Showing {visibleItems.length} of {review.length} reviewed outcomes. Filters change this view only; release includes all {eligible.length} eligible outcomes in the full reviewed cohort.</p>
      <div className="my-4 flex flex-wrap gap-3">
        <button type="button" disabled={pending || !eligible.length} onClick={() => void releaseReviewed()} className="button-primary text-sm">{pending ? "Releasing…" : `Release ${eligible.length} eligible outcome${eligible.length === 1 ? "" : "s"}`}</button>
        <button type="button" disabled={pending} onClick={() => { setReview(null); window.requestAnimationFrame(() => reviewTriggerRef.current?.focus()); }} className="button-secondary text-sm">Cancel</button>
      </div>
      <div tabIndex={0} role="region" aria-label="Filtered reviewed outcomes" className="max-h-[28rem] overflow-y-auto overscroll-contain focus:outline-2 focus:outline-offset-2 focus:outline-mecg-navy">{visibleItems.length ? itemList(visibleItems) : <p className="py-4">No outcomes match these filters. The full reviewed cohort is unchanged.</p>}</div>
    </section>}
    {report && <section ref={resultRef} tabIndex={-1} aria-label="Batch release result" className="w-full border border-line p-4 sm:p-5">
      <p role="status" className="font-semibold">{report.released} released · {report.skipped} skipped</p>
      <p className="mt-2 leading-6 text-muted">Released outcomes are visible to applicants. Their emails are queued; delivery is not yet confirmed. <Link href={withWorkspaceCycle("/admin/messages", cycleId)} className="inline-flex min-h-11 items-center underline underline-offset-2">Open delivery log</Link></p>
      {report.skipped > 0 && <><h3 className="mt-3 font-semibold">Resolve skipped outcomes, then review remaining outcomes to retry</h3>{itemList(report.items.filter((item) => item.reasonCode !== null))}</>}
    </section>}
  </div>;
}

// An offer with no deadline leaves the cohort open indefinitely. The RPC
// enforces expiry in respond_to_offer, so this only has to collect the date.
export function OfferDeadlineForm({ applicationId, current }: { applicationId: string; current: string | null }) {
  return <OfferDeadlineEditor key={applicationId} applicationId={applicationId} current={current} />;
}

function OfferDeadlineEditor({ applicationId, current }: { applicationId: string; current: string | null }) {
  const router = useRouter();
  const fieldId = useId();
  const busy = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState("");
  const [edited, setEdited] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [proposed, setProposed] = useState<string | null>(null);
  const [value, setValue] = useState(() => current ? formatDetroitDateTime(current) : "");

  async function save(value: string) {
    if (busy.current || uncertain) return;
    let expiresAt: string | null;
    try { expiresAt = value ? detroitDateTimeToIso(value, current ?? undefined) : null; }
    catch (conversionError) {
      setError(conversionError instanceof Error ? conversionError.message : "Enter a valid Detroit date and time.");
      setSuccess("");
      requestAnimationFrame(() => resultRef.current?.focus());
      return;
    }
    busy.current = true;
    setValue(value);
    setProposed(expiresAt);
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/admin/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_DEADLINE", applicationId, expiresAt: expiresAt ?? "" }),
      }, 15_000, authorizedFetch);
      if (!response.ok && response.status < 500 && response.status !== 408) {
        setError(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Could not set the deadline. Your proposed date is unchanged.");
        return;
      }
      if (!response.ok || !body || typeof body !== "object" || Array.isArray(body)
        || !("kind" in body) || body.kind !== "deadline-set"
        || !("applicationId" in body) || body.applicationId !== applicationId
        || !("expiresAt" in body) || body.expiresAt !== expiresAt) {
        setUncertain(true);
        return;
      }
      setSuccess(expiresAt ? `Deadline saved: ${formatEasternDateTime(expiresAt)}.` : "Deadline cleared. This offer has no deadline.");
      setEdited(false);
      router.refresh();
    } catch { setUncertain(true); }
    finally {
      busy.current = false;
      setPending(false);
      requestAnimationFrame(() => resultRef.current?.focus());
    }
  }

  return (
    <form
      className="flex flex-col items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save(String(new FormData(event.currentTarget).get("expiresAt") ?? ""));
      }}
    >
      <label className="text-xs font-semibold text-muted">
        Offer deadline (Detroit time)
        <input
          type="datetime-local"
          name="expiresAt"
          disabled={pending || uncertain}
          value={value}
          aria-describedby={`${fieldId}-result`}
          onChange={(event) => { setValue(event.target.value); setSuccess(""); setError(""); setEdited(true); }}
          className="mt-1.5 block min-h-11 rounded-xl bg-wash px-3 text-sm inset-ring inset-ring-line-strong outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)] disabled:opacity-60"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || uncertain} className="button-secondary text-xs">
          {pending ? "Saving…" : "Save deadline"}
        </button>
        <button type="button" disabled={pending || uncertain} onClick={() => void save("")} className="button-secondary text-xs">Clear deadline</button>
      </div>
      <div id={`${fieldId}-result`} ref={resultRef} tabIndex={-1} aria-label="Offer deadline save result">
        <OperationNotice kind="error">{error}</OperationNotice>
        <OperationNotice kind="success">{success}</OperationNotice>
        {edited && !pending && !uncertain && !success && <p role="status" className="text-sm text-muted">Changes not saved.</p>}
        {uncertain && <>
          <OperationNotice kind="info">The deadline save could not be confirmed. It may already be applied. Proposed value: {proposed ? formatEasternDateTime(proposed) : "no deadline"}. Keep a copy of this value, then reload the current offer to check its saved deadline before another change.</OperationNotice>
          <button type="button" className="button-secondary mt-2" onClick={() => window.location.reload()}>Reload current offer deadline</button>
        </>}
      </div>
    </form>
  );
}
