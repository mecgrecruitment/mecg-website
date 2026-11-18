import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Navigation hint only. Any failure (including the RPC not existing yet)
// hides the link; the page itself re-checks access.
export const leadsAnyProject = cache(async (): Promise<boolean> => {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("engagement_leads_any");
    return !error && data === true;
  } catch {
    return false;
  }
});
