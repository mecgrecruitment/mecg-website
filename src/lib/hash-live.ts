import { canonicalMajor } from "./major";
import { CLASS_YEAR_LABELS } from "./workflow";

// rush.member_hash_live's answer, and the shape the phone ballot renders from it.
type BallotRow = { id: string; name: string; major: string | null; class_year: string | null };
export type HashLiveNote = { source: string; note: string };
export type HashLiveRpc = { presenting: BallotRow | null; applicationId: string | null; notes: HashLiveNote[] };
export type HashLivePresenting = { id: string; name: string; meta: string; decided: null };
export type HashLive = { presentingId: string | null; presenting: HashLivePresenting | null; applicationId: string | null; notes: HashLiveNote[] };

export function hashLive(data: HashLiveRpc): HashLive {
  const row = data.presenting;
  const presenting = row ? {
    id: row.id,
    name: row.name,
    meta: [row.major ? canonicalMajor(row.major) : "", row.class_year ? Object.entries(CLASS_YEAR_LABELS).find(([year]) => year === row.class_year)?.[1] ?? row.class_year : ""].filter(Boolean).join(" · "),
    decided: null,
  } : null;
  return { presentingId: presenting?.id ?? null, presenting, applicationId: data.applicationId, notes: Array.isArray(data.notes) ? data.notes : [] };
}

type PollOutcome = "ok" | "signed-out" | "failed";
type HashLiveClient = {
  rpc: (name: "member_hash_live", args: { target_cycle_id: string | null; target_application_id: string }) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
};

// Phones call member_hash_live straight from the browser, so a room of polling
// laptops costs the site's server nothing. 28000 is a missing or inactive sign-in
// and 42501 a lost seat on this ballot; another poll will not fix either.
export async function pollHashLive(client: HashLiveClient, cycleId?: string, applicationId?: string): Promise<{ outcome: PollOutcome; live: HashLive | null }> {
  try {
    const { data, error } = await client.rpc("member_hash_live", { target_cycle_id: cycleId ?? null, target_application_id: applicationId ?? "" });
    if (error) return { outcome: error.code === "28000" || error.code === "42501" ? "signed-out" : "failed", live: null };
    if (!data || typeof data !== "object") return { outcome: "failed", live: null };
    return { outcome: "ok", live: hashLive(data as HashLiveRpc) };
  } catch {
    return { outcome: "failed", live: null };
  }
}
