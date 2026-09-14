"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Headshot from "@/components/applicant-headshot";
import OperationNotice from "@/components/operation-notice";
import { formatStars } from "@/app/admin/speed-dating-results";
import { authorizedFetch, retryOnNetworkError } from "@/lib/client-fetch";
import type { GroupCaseApplicant, GroupCaseRoster } from "@/lib/group-case-roster";
import { matchesApplicantName } from "@/lib/speed-dating-roster";

function statusChip(status: GroupCaseApplicant["assignmentStatus"]) {
  if (status === "SUBMITTED" || status === "LOCKED") return { label: "Submitted", className: "bg-emerald-50 text-emerald-800" };
  if (status === "ASSIGNED" || status === "IN_PROGRESS") return { label: "In your queue", className: "bg-mecg-orange/[0.16] text-mecg-orange-ink" };
  return { label: "Not started", className: "bg-mecg-navy/[0.06] text-mecg-navy/55" };
}

export default function GroupCaseRoster({ initial }: { initial: GroupCaseRoster }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [failedHeadshots, setFailedHeadshots] = useState<Set<string>>(() => new Set());

  const readOnly = initial.roundStatus !== "ACTIVE";
  const everyone = useMemo(() => initial.groups.flatMap((group) => group.applicants), [initial.groups]);
  const queued = everyone.filter((applicant) => applicant.assignmentId).length;
  const visibleGroups = useMemo(() => initial.groups
    .map((group) => ({ ...group, applicants: group.applicants.filter((applicant) => matchesApplicantName(applicant.name, query)) }))
    .filter((group) => group.applicants.length > 0), [initial.groups, query]);

  function markHeadshotFailed(applicationId: string) {
    setFailedHeadshots((current) => current.has(applicationId) ? current : new Set(current).add(applicationId));
  }

  async function add(applicationIds: string[]) {
    if (!applicationIds.length) return;
    setError("");
    setPending((current) => new Set([...current, ...applicationIds]));
    try {
      // Adding is idempotent on the server, so resending after a dropped connection is safe.
      const response = await retryOnNetworkError(() => authorizedFetch("/api/member/group-case/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roundId: initial.roundId, applicationIds }),
      }));
      const body: { error?: string } | null = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not add these applicants");
      router.refresh();
    } catch (addError) {
      setError(addError instanceof Error && !(addError instanceof TypeError)
        ? addError.message
        : "No connection. Check wifi and try again.");
    } finally {
      setPending((current) => {
        const copy = new Set(current);
        applicationIds.forEach((id) => copy.delete(id));
        return copy;
      });
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mecg-orange-ink">{initial.roundName}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-mecg-navy/65" aria-live="polite">{queued} in your queue</p>
        <Link href="/member?round=GROUP_CASE" className="button-secondary inline-flex text-sm">Go to my Group Case queue</Link>
      </div>
      <div className="relative mt-4">
        <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mecg-navy/45" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a name"
          aria-label="Search applicants"
          autoComplete="off"
          className="min-h-12 w-full rounded-xl border border-mecg-navy/15 bg-white py-3 pl-12 pr-4 text-base text-mecg-navy outline-none transition focus:border-mecg-blue focus:ring-4 focus:ring-mecg-blue/10"
        />
      </div>

      {readOnly && <div className="mt-4"><OperationNotice kind="info">Grading opens when the board starts the round.</OperationNotice></div>}
      {error && <div className="mt-4"><OperationNotice kind="error">{error}</OperationNotice></div>}

      {visibleGroups.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-mecg-navy/15 px-5 py-8 text-center">
          <p className="font-semibold text-mecg-navy">{everyone.length === 0 ? "No applicants are enrolled yet" : `No applicant matches “${query.trim()}”`}</p>
          <p className="mt-1 text-sm text-mecg-navy/55">{everyone.length === 0 ? "Applicants appear here once the Board moves them into Group Case." : "Check the spelling or try their other name."}</p>
        </div>
      )}
      {visibleGroups.map((group) => {
        const missing = group.applicants.filter((applicant) => !applicant.assignmentId).map((applicant) => applicant.applicationId);
        return (
          <section key={group.groupId ?? "ungrouped"} className="mt-5" aria-label={group.groupName}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-mecg-navy">{group.groupName}</h3>
              <button
                type="button"
                disabled={readOnly || missing.length === 0 || missing.some((id) => pending.has(id))}
                onClick={() => add(missing)}
                className="button-secondary inline-flex min-h-9 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add whole group
              </button>
            </div>
            <ul className="mt-2 divide-y divide-mecg-navy/10">
              {group.applicants.map((applicant) => {
                const chip = statusChip(applicant.assignmentStatus);
                return (
                  <li key={applicant.applicationId} className="-mx-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-2 py-3">
                    <Headshot applicant={applicant} failed={failedHeadshots.has(applicant.applicationId)} onFail={() => markHeadshotFailed(applicant.applicationId)} />
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="font-semibold text-mecg-navy">{applicant.name}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.className}`}>{chip.label}</span>
                        {applicant.speedDating && (
                          <span
                            className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900"
                            title={`${applicant.speedDating.count} Speed Dating ${applicant.speedDating.count === 1 ? "grader" : "graders"}`}
                          >
                            {formatStars(applicant.speedDating.adjusted)}
                          </span>
                        )}
                      </p>
                    </div>
                    {!applicant.assignmentId && (
                      <button
                        type="button"
                        disabled={readOnly || pending.has(applicant.applicationId)}
                        onClick={() => add([applicant.applicationId])}
                        aria-label={`Add ${applicant.name} to my queue`}
                        className="button-primary inline-flex min-h-11 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {pending.has(applicant.applicationId) ? "Adding…" : "Add"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
