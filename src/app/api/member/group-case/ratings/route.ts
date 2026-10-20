import { NextRequest, NextResponse } from "next/server";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

import { parseGroupCaseWriteRequest, parseGroupCaseWriteResult } from "@/lib/group-case-write";
export type { GroupCaseWriteResult } from "@/lib/group-case-write";

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedBody = await readJsonBody(req, 16 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  const rating = parsedBody.error ? null : parseGroupCaseWriteRequest(parsedBody.data);
  if (!rating) return NextResponse.json({ error: "Reload the grading workspace before saving; a valid revision and mutation receipt are required." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await screeningRpc<unknown>(supabase, "rate_group_case_applicant_v2", {
    target_round_id: rating.roundId,
    target_application_id: rating.applicationId,
    scores: rating.scores,
    note: rating.note,
    expected_revision: rating.expectedRevision,
    mutation_id: rating.mutationId,
  });
  if (error) {
    console.error("rate_group_case_applicant_v2 failed", { code: error.code ?? "unknown" });
    const mapped = mapRpcErrorVerbose(error, "This rating could not be saved");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  const result = parseGroupCaseWriteResult(data);
  if (!result || (result.kind === "saved" ? result.applicationId !== rating.applicationId || result.mutationId !== rating.mutationId : result.snapshot.applicationId !== rating.applicationId)) return NextResponse.json({ error: "The save result could not be confirmed. It may already be saved; keep your observations and retry the same request." }, { status: 503 });
  return NextResponse.json(result, { status: result.kind === "conflict" ? 409 : 200 });
}
