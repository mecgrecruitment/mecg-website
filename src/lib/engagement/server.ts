import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseTracker, type Tracker } from "./model";
import { parseCloseoutOverview, type Closeout } from "./closeout";

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

// Board only. Null on any failure, so no partial close-out state is shown.
export async function loadCloseouts(): Promise<Record<string, Closeout> | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("client_closeout_overview");
    if (error) throw error;
    return Object.fromEntries(parseCloseoutOverview(data));
  } catch (error) {
    console.error("client_closeout_overview unavailable", error);
    return null;
  }
}
