import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseStanding, parseThresholds, type Standing, type StoredThresholds } from "./model";

// Returns null when the rollup cannot be read (RPC missing before the
// migration, access refused, or a malformed response) so the page shows an
// unavailable state and no partial standing data.
export async function loadStanding(cycleId: string): Promise<Standing | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("member_standing", { target_cycle_id: cycleId });
    if (error) throw error;
    const parsed = parseStanding(data);
    if (!parsed || parsed.cycleId !== cycleId) throw new Error("member_standing returned an unusable payload");
    return parsed;
  } catch (error) {
    console.error("member_standing unavailable", error);
    return null;
  }
}

// Cycle settings needs only the thresholds, not the member rollup.
export async function loadStandingThresholds(cycleId: string): Promise<StoredThresholds | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("member_standing_thresholds", { target_cycle_id: cycleId });
    if (error) throw error;
    const parsed = parseThresholds(data);
    if (!parsed) throw new Error("member_standing_thresholds returned an unusable payload");
    return parsed;
  } catch (error) {
    console.error("member_standing_thresholds unavailable", error);
    return null;
  }
}
