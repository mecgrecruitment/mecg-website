import { NextRequest, NextResponse } from "next/server";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

export type GroupCaseAssignmentsResult = { assignmentIds: string[]; created: number; skippedConflicts: number };

function parseRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { roundId, applicationIds } = value as Record<string, unknown>;
  if (typeof roundId !== "string" || !roundId || roundId.length > 200) return null;
  if (!Array.isArray(applicationIds) || applicationIds.length < 1 || applicationIds.length > 50) return null;
  if (!applicationIds.every((id) => typeof id === "string" && id && id.length <= 200)) return null;
  return { roundId, applicationIds: applicationIds as string[] };
}

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedBody = await readJsonBody(req, 16 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  const request = parsedBody.error ? null : parseRequest(parsedBody.data);
  if (!request) return NextResponse.json({ error: "Pick between 1 and 50 applicants" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await screeningRpc<GroupCaseAssignmentsResult>(supabase, "open_group_case_assignments", {
    target_round_id: request.roundId,
    target_application_ids: request.applicationIds,
  });
  if (error) {
    console.error("open_group_case_assignments failed", error);
    const mapped = mapRpcErrorVerbose(error, "Could not add these applicants");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json(data);
}
