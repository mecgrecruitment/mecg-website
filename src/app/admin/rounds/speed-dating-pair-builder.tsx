"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SpeedDatingPairSetup } from "@/lib/speed-dating-pairs";

type DraftPair = { applicationIds: [string, string] };

export default function SpeedDatingPairBuilder({ cycleId, setup }: { cycleId: string; setup: SpeedDatingPairSetup }) {
  const router = useRouter();
  const [pairs, setPairs] = useState<DraftPair[]>(() => setup.pairs.map((pair) => ({ applicationIds: [...pair.applicationIds] })));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editable = ["DRAFT", "PUBLISHED"].includes(setup.roundStatus);
  const selectedIds = pairs.flatMap((pair) => pair.applicationIds).filter(Boolean);
  const duplicates = selectedIds.filter((id, index) => selectedIds.indexOf(id) !== index);
  const unpaired = setup.participants.filter((participant) => !selectedIds.includes(participant.applicationId));
  const complete = pairs.length > 0
    && pairs.every((pair) => pair.applicationIds[0] && pair.applicationIds[1] && pair.applicationIds[0] !== pair.applicationIds[1])
    && duplicates.length === 0;
  const publishable = complete && unpaired.length === 0;

  function createDraftPairs() {
    const ordered = [...setup.participants].sort((a, b) => a.name.localeCompare(b.name) || a.applicationId.localeCompare(b.applicationId));
    const next: DraftPair[] = [];
    for (let index = 0; index + 1 < ordered.length; index += 2) {
      next.push({ applicationIds: [ordered[index].applicationId, ordered[index + 1].applicationId] });
    }
    setPairs(next);
    setError("");
    setNotice(ordered.length % 2 ? "Draft pairs created. One applicant still needs a partner before publication." : "Draft pairs created. Review them before publishing.");
  }

  function updatePair(index: number, position: 0 | 1, applicationId: string) {
    setPairs((current) => current.map((pair, pairIndex) => pairIndex === index
      ? { applicationIds: pair.applicationIds.map((id, memberIndex) => memberIndex === position ? applicationId : id) as [string, string] }
      : pair));
    setNotice("");
    setError("");
  }

  async function save(publish: boolean) {
    if (!complete || (publish && !publishable)) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/rush", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cycleId,
          action: "SET_SPEED_DATING_PAIRS",
          roundId: setup.roundId,
          pairs,
          publish,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not save Speed Dating pairs");
      setNotice(publish ? "Pairs published. Members can search them when the round starts." : "Draft pairs saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save Speed Dating pairs");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl bg-paper p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-mecg-navy/50">Two-person pair setup</p>
          <h2 className="mt-1 text-xl font-semibold text-mecg-navy">Build and verify every pair</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-mecg-navy/60">Automatic pairing creates an alphabetical draft only. Review both names in every row; publishing makes these pairs searchable during the round.</p>
        </div>
        {editable && <button type="button" onClick={createDraftPairs} disabled={pending || setup.participants.length < 2} className="button-secondary">Create draft pairs</button>}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <ol className="space-y-2">
          {pairs.map((pair, index) => (
            <li key={index} className="grid gap-2 rounded-xl bg-white p-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:grid-cols-[5rem_1fr_1fr_auto] sm:items-center">
              <span className="text-xs font-semibold text-mecg-orange-ink">Pair {String(index + 1).padStart(2, "0")}</span>
              {[0, 1].map((position) => (
                <label key={position} className="text-xs font-medium text-mecg-navy/55">
                  Applicant {position + 1}
                  <select
                    value={pair.applicationIds[position]}
                    disabled={!editable || pending}
                    onChange={(event) => updatePair(index, position as 0 | 1, event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl bg-mecg-navy/[0.035] px-3 text-sm font-medium text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]"
                  >
                    <option value="">Choose applicant</option>
                    {setup.participants.map((participant) => <option key={participant.applicationId} value={participant.applicationId}>{participant.name}</option>)}
                  </select>
                </label>
              ))}
              {editable && (
                <button type="button" onClick={() => setPairs((current) => current.filter((_, pairIndex) => pairIndex !== index))} disabled={pending} className="min-h-11 px-2 text-xs font-semibold text-red-700">Remove</button>
              )}
            </li>
          ))}
          {!pairs.length && <li className="rounded-xl border border-dashed border-mecg-navy/15 p-6 text-center text-sm text-mecg-navy/55">No pairs yet. Create a draft, then review every row.</li>}
        </ol>

        <aside className="h-fit rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
          <p className="text-sm font-semibold text-mecg-navy">Publish checklist</p>
          <ul className="mt-3 space-y-2 text-xs text-mecg-navy/65">
            <li>{complete ? "✓" : "○"} Every row has two different people</li>
            <li>{duplicates.length === 0 ? "✓" : "○"} Nobody appears twice</li>
            <li>{unpaired.length === 0 ? "✓" : "○"} Everyone has a partner</li>
          </ul>
          {unpaired.length > 0 && (
            <div className="mt-4 border-t border-mecg-navy/10 pt-3">
              <p className="text-xs font-semibold text-red-700">Unpaired · {unpaired.length}</p>
              <p className="mt-1 text-xs leading-5 text-mecg-navy/60">{unpaired.map((participant) => participant.name).join(", ")}</p>
            </div>
          )}
          {duplicates.length > 0 && <p className="mt-3 text-xs font-semibold text-red-700">Remove duplicate selections before saving.</p>}
        </aside>
      </div>

      {editable && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void save(false)} disabled={pending || !complete} className="button-secondary">{pending ? "Saving…" : "Save draft"}</button>
          <button type="button" onClick={() => void save(true)} disabled={pending || !publishable} className="button-primary">Review complete · Publish pairs</button>
          <button type="button" onClick={() => setPairs((current) => [...current, { applicationIds: ["", ""] }])} disabled={pending || pairs.length >= 200} className="min-h-11 px-3 text-sm font-semibold text-mecg-blue">+ Add pair</button>
        </div>
      )}
      {!editable && <p className="mt-4 text-sm text-mecg-navy/60">Pairs are locked because the round has started. Existing grades and pair membership cannot be rewritten.</p>}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {notice && <p className="mt-3 text-sm text-emerald-800" role="status">{notice}</p>}
    </section>
  );
}
