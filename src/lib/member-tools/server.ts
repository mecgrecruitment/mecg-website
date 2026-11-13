import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isObject, parseRecords, type ToolKind } from "./model";

export async function loadToolWorkspace(cycleId: string, kind: ToolKind) {
  const client = await createClient();
  const { data, error } = await client.rpc("member_tool_workspace", { c: cycleId, k: kind });
  if (error) throw error;
  if (!isObject(data) || typeof data.canReview !== "boolean" || typeof data.canManageAccess !== "boolean") throw new Error("Invalid workspace response");
  return { records: parseRecords(data.records), canReview: data.canReview, canManageAccess: data.canManageAccess };
}
