import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";
import { isUuid, parseHandoffInput } from "@/lib/officer-handoff/model";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

// Handoffs are org-wide, so there is no cycle to check. The database function
// re-checks active Board or Owner membership and who can be named as an
// officer on every call; this route refuses obvious non-board callers and
// malformed input before the round trip.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.memberships.some((membership) => membership.active && ["BOARD", "OWNER"].includes(membership.role))) {
    return NextResponse.json({ error: "Board access required." }, { status: 403 });
  }
  const body = await readJsonBody(request, 64 * 1024);
  if (body.error) return NextResponse.json({ error: "Invalid or oversized form." }, { status: body.error === "too_large" ? 413 : 400 });
  const input = body.data;
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("Invalid form.");
  const fields = input as Record<string, unknown>;
  if (Object.keys(fields).some((key) => !["id", "revision", "handoff"].includes(key))) return bad("Invalid form.");
  const { id, revision } = fields;
  if (id !== null && !isUuid(id)) return bad("Invalid handoff.");
  // A new handoff starts from revision 0; an edit names the revision it was opened at.
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || (id === null ? revision !== 0 : revision < 1)) return bad("Invalid record revision.");
  const handoff = parseHandoffInput(fields.handoff);
  if (!handoff.ok) return bad(handoff.error);
  if (id === null && handoff.value.items.some((item) => item.id !== null)) return bad("Check the checklist items.");

  const client = await createClient();
  const { error } = await client.rpc("save_officer_handoff", { target_id: id, expected_revision: revision, payload: handoff.value });
  if (error) {
    const mapped = mapRpcErrorVerbose(error, "Could not save. Reload to check the current handoff before retrying.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}
