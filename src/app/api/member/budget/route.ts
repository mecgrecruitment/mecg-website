import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";
import { canRequestBudget } from "@/lib/budget/access";
import { parseBudgetRequestInput } from "@/lib/budget/model";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

// Submits or edits the caller's own budget request. Requests are org-wide, so
// there is no cycle to check. The database re-checks active membership and
// ownership on every call; this route refuses obvious outsiders and malformed
// input before the round trip.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canRequestBudget(user.memberships)) return NextResponse.json({ error: "Active membership required." }, { status: 403 });
  const body = await readJsonBody(request, 16 * 1024);
  if (body.error) return NextResponse.json({ error: "Invalid or oversized form." }, { status: body.error === "too_large" ? 413 : 400 });
  const input = body.data;
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("Invalid form.");
  const fields = input as Record<string, unknown>;
  if (Object.keys(fields).some((key) => !["id", "revision", "request"].includes(key))) return bad("Invalid form.");
  const { id, revision } = fields;
  if (id !== null && (typeof id !== "string" || !uuid.test(id))) return bad("Invalid request.");
  // A new request starts from revision 0; an edit names the revision it was opened at.
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || (id === null ? revision !== 0 : revision < 1)) return bad("Invalid record revision.");
  const parsed = parseBudgetRequestInput(fields.request);
  if (!parsed.ok) return bad(parsed.error);

  const client = await createClient();
  const { error } = await client.rpc("save_budget_request", { target_id: id, expected_revision: revision, payload: parsed.value });
  if (error) {
    const mapped = mapRpcErrorVerbose(error, "Could not save. Reload to check your requests before retrying.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}
