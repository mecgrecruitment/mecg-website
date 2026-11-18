import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseHandoffBoard, type HandoffBoard } from "./model";

// Returns null when handoffs cannot be read (RPC missing before the migration,
// access refused, or a malformed response) so the page shows an unavailable
// state and no partial checklists.
export async function loadHandoffs(): Promise<HandoffBoard | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("officer_handoffs");
    if (error) throw error;
    return parseHandoffBoard(data);
  } catch (error) {
    console.error("officer_handoffs unavailable", error);
    return null;
  }
}
