import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseRollup, type Rollup } from "./model";

// Returns null when the rollup cannot be read (RPC missing before the
// migration, access refused, or a malformed response) so the page shows an
// unavailable state and no partial counts.
export async function loadPipelineRollup(cycleId: string): Promise<Rollup | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("pipeline_rollup", { target_cycle_id: cycleId });
    if (error) throw error;
    const parsed = parseRollup(data);
    if (!parsed || parsed.cycleId !== cycleId) throw new Error("pipeline_rollup returned an unusable payload");
    return parsed;
  } catch (error) {
    console.error("pipeline_rollup unavailable", error);
    return null;
  }
}
