import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseTracker, type Tracker } from "./model";

// Returns null when the tracker cannot be read (RPC missing before the
// migration, or a malformed response) so the page shows an unavailable state
// and no partial delivery data.
export async function loadTracker(): Promise<Tracker | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("engagement_tracker");
    if (error) throw error;
    return parseTracker(data);
  } catch (error) {
    console.error("engagement_tracker unavailable", error);
    return null;
  }
}
