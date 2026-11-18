import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";
import { canRequestBudget, canReviewBudget } from "@/lib/budget/access";
import { actions, parseActionPayload, type BudgetAction } from "@/lib/budget/model";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

// Moves a request on: the requester withdraws; the board approves, denies or
// records that it was paid. The database re-checks the role, that nobody acts
// on their own request, the status and the revision on every call.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJsonBody(request, 8 * 1024);
  if (body.error) return NextResponse.json({ error: "Invalid or oversized form." }, { status: body.error === "too_large" ? 413 : 400 });
  const input = body.data;
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("Invalid form.");
  const fields = input as Record<string, unknown>;
  if (Object.keys(fields).some((key) => !["id", "revision", "action", "payload"].includes(key))) return bad("Invalid form.");
  const { id, revision, action } = fields;
  if (!(actions as readonly unknown[]).includes(action)) return bad("Unknown action.");
  const step = action as BudgetAction;
  const allowed = step === "WITHDRAW" ? canRequestBudget(user.memberships) : canReviewBudget(user.memberships);
  if (!allowed) return NextResponse.json({ error: step === "WITHDRAW" ? "Active membership required." : "Board access required." }, { status: 403 });
  if (typeof id !== "string" || !uuid.test(id)) return bad("Invalid request.");
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) return bad("Invalid record revision.");
  const payload = parseActionPayload(step, fields.payload);
  if (!payload.ok) return bad(payload.error);

  const client = await createClient();
  const { error } = await client.rpc("act_on_budget_request", { target_id: id, expected_revision: revision, action: step, payload: payload.value });
  if (error) {
    const mapped = mapRpcErrorVerbose(error, "Could not save. Reload to check the request before retrying.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}
