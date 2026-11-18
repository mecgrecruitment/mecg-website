import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseDecisionLog, type DecisionLog } from "./model";

// Returns null when the log cannot be read (RPC missing before the migration,
// access refused, or a malformed response) so the page shows an unavailable
// state and no partial entries.
export async function loadDecisionLog(): Promise<DecisionLog | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("board_decision_log");
    if (error) throw error;
    return parseDecisionLog(data);
  } catch (error) {
    console.error("board_decision_log unavailable", error);
    return null;
  }
}
