import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { readJsonBody, mapRpcErrorVerbose } from "@/lib/api-route";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { isObject, isToolKind, parseContent, parseReview } from "@/lib/member-tools/model";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJsonBody(request, 48 * 1024);
  if (body.error) return NextResponse.json({ error: "Invalid or oversized form." }, { status: body.error === "too_large" ? 413 : 400 });
  const input = body.data;
  if (!isObject(input) || typeof input.cycleId !== "string" || !isToolKind(input.kind)) return NextResponse.json({ error: "Invalid workspace." }, { status: 400 });
  if (!hasPermission(user.memberships, input.cycleId, "WORKSPACE_ACCESS")) return NextResponse.json({ error: "Membership required." }, { status: 403 });
  const client = await createClient();
  let result;
  if (input.action === "access") {
    if (typeof input.userId !== "string" || !uuid.test(input.userId) || typeof input.enabled !== "boolean") return NextResponse.json({ error: "Enter the member’s profile UUID." }, { status: 400 });
    result = await client.rpc("set_member_tool_reviewer", { c: input.cycleId, k: input.kind, target_user: input.userId, enabled: input.enabled });
  } else {
    if (typeof input.id !== "string" || !uuid.test(input.id) || typeof input.revision !== "number" || !Number.isSafeInteger(input.revision) || input.revision < 0) return NextResponse.json({ error: "Invalid record revision." }, { status: 400 });
    if (input.action === "save") {
      const content = parseContent(input.kind, input.content);
      if (!content.ok) return NextResponse.json({ error: content.error }, { status: 400 });
      result = await client.rpc("save_member_tool", { c: input.cycleId, k: input.kind, record_id: input.id, expected_revision: input.revision, payload: { ...content.value } });
    } else if (input.action === "review") {
      const review = parseReview(isObject(input.review) ? { ...input.review, reviewerId: null } : null);
      if (!review) return NextResponse.json({ error: "Review needs valid notes and, for clearance, a permission source and scope." }, { status: 400 });
      result = await client.rpc("review_member_tool", { c: input.cycleId, k: input.kind, record_id: input.id, expected_revision: input.revision, payload: { verification: review.verification, sharing: review.sharing, note: review.note, source: review.source, scope: review.scope } });
    } else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  if (result.error) {
    const mapped = mapRpcErrorVerbose(result.error, "Could not save. Reload to check the current record before retrying.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}
