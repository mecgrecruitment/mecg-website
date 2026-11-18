import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";
import { canUseAlumniDirectory } from "@/lib/alumni/access";
import { parseListingInput } from "@/lib/alumni/model";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

// Adds or edits the caller's own alumni listing. The database re-checks active
// membership on every call and only ever writes the caller's row; this route
// refuses obvious outsiders and malformed input before the round trip.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseAlumniDirectory(user.memberships)) return NextResponse.json({ error: "Active membership required." }, { status: 403 });
  const body = await readJsonBody(request, 16 * 1024);
  if (body.error) return NextResponse.json({ error: "Invalid or oversized form." }, { status: body.error === "too_large" ? 413 : 400 });
  const input = body.data;
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("Invalid form.");
  const fields = input as Record<string, unknown>;
  if (Object.keys(fields).some((key) => !["revision", "listing"].includes(key))) return bad("Invalid form.");
  // A first listing is saved at revision 0; an edit names the revision it was opened at.
  const { revision } = fields;
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) return bad("Invalid listing revision.");
  const parsed = parseListingInput(fields.listing);
  if (!parsed.ok) return bad(parsed.error);

  const client = await createClient();
  const { error } = await client.rpc("save_alumni_listing", { expected_revision: revision, payload: parsed.value });
  if (error) {
    const mapped = mapRpcErrorVerbose(error, "Could not save. Reload to check your listing before retrying.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}
