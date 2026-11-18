import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseBudgetRequestList, type BudgetRequestList } from "./model";

// Both loaders return null when the list cannot be read (RPC missing before
// the migration, access refused, or a malformed response) so the page shows
// an unavailable state and no partial entries.
async function load(rpc: "my_budget_requests" | "budget_request_log"): Promise<BudgetRequestList | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc(rpc);
    if (error) throw error;
    return parseBudgetRequestList(data);
  } catch (error) {
    console.error(`${rpc} unavailable`, error);
    return null;
  }
}

export const loadMyBudgetRequests = () => load("my_budget_requests");
export const loadBudgetRequestLog = () => load("budget_request_log");
