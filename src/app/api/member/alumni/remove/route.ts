import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

// Removes an alumni listing. { id: null } opts the caller out of their own
// listing, which needs only a signed-in account so that leaving the club never
// blocks opting out. { id } removes that listing: the caller's own, or anyone's
// for a board member. The database decides; this route only checks shape.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJsonBody(request, 1024);
  if (body.error) return NextResponse.json({ error: "Invalid or oversized form." }, { status: body.error === "too_large" ? 413 : 400 });
  const input = body.data;
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("Invalid form.");
  const fields = input as Record<string, unknown>;
  if (Object.keys(fields).length !== 1 || !("id" in fields)) return bad("Invalid form.");
  const { id } = fields;
  if (id !== null && (typeof id !== "string" || !uuid.test(id))) return bad("Invalid listing.");

  const client = await createClient();
  const { data, error } = await client.rpc("remove_alumni_listing", { target_id: id });
  if (error) {
    const mapped = mapRpcErrorVerbose(error, "Could not remove the listing. Reload to check before retrying.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true, removed: data === true });
}
