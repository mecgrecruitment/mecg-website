import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";
import { parseRetentionInput } from "@/lib/cycle-records/model";

// Retention periods are organisation-wide configuration for any active Owner.
// Saving one only changes what the dry-run report counts; nothing is deleted.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.memberships.some((membership) => membership.active && membership.role === "OWNER")) {
    return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  }
  const body = await readJsonBody(request, 4 * 1024);
  if (body.error) return NextResponse.json({ error: "Invalid form." }, { status: body.error === "too_large" ? 413 : 400 });
  const input = parseRetentionInput(body.data);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  const client = await createClient();
  const { data, error } = await client.rpc("save_retention_policy", {
    target_category: input.value.category, months: input.value.keepMonths, expected_revision: input.value.revision,
  });
  if (error) {
    if (error.code === "40001") return NextResponse.json({ error: "This period changed since you opened the page. Reload before saving." }, { status: 409 });
    const mapped = mapRpcErrorVerbose(error, "Could not save. Reload to check the current period.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true, ...(data && typeof data === "object" ? data : {}) });
}
