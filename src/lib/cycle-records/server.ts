import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseOverview, parseRetentionReport, type Overview, type RetentionReport } from "./model";

// Each returns null when the read fails (RPC missing before the migration,
// access refused, or a malformed response) so the page shows an unavailable
// state and no partial figures.
export async function loadCycleRecordsOverview(cycleId: string): Promise<Overview | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("cycle_records_overview", { c: cycleId });
    if (error) throw error;
    return parseOverview(data);
  } catch (error) {
    console.error("cycle_records_overview unavailable", error);
    return null;
  }
}

export async function loadRetentionReport(): Promise<RetentionReport | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("retention_report");
    if (error) throw error;
    return parseRetentionReport(data);
  } catch (error) {
    console.error("retention_report unavailable", error);
    return null;
  }
}
