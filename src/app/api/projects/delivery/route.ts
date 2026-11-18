import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";
import { parseDeliveryInput, parseHealthInput } from "@/lib/engagement/model";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

// Projects are org-wide, so there is no cycle to check here. The database
// functions decide board versus project-lead access on every call; this route
// only refuses malformed input before the round trip.
type Client = Awaited<ReturnType<typeof createClient>>;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.memberships.some((membership) => membership.active)) return NextResponse.json({ error: "Membership required." }, { status: 403 });
  const body = await readJsonBody(request, 64 * 1024);
  if (body.error) return NextResponse.json({ error: "Invalid or oversized form." }, { status: body.error === "too_large" ? 413 : 400 });
  const input = body.data;
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("Invalid form.");
  const { action, projectId, revision } = input as Record<string, unknown>;
  if (typeof projectId !== "string" || !projectId || projectId.length > 100) return bad("Choose a project.");
  // Health is a single-writer stamp by the lead and carries no revision.
  if (action !== "health" && (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)) return bad("Invalid record revision.");

  const fields = input as Record<string, unknown>;
  let call: (client: Client) => PromiseLike<{ error: { code?: string; message: string } | null }>;
  if (action === "save") {
    const delivery = parseDeliveryInput(fields.delivery);
    if (!delivery.ok) return bad(delivery.error);
    call = (client) => client.rpc("save_project_delivery", { target_project_id: projectId, expected_revision: revision as number, payload: delivery.value });
  } else if (action === "health") {
    const parsed = parseHealthInput({ health: fields.health, note: fields.note });
    if (!parsed.ok) return bad(parsed.error);
    call = (client) => client.rpc("set_project_health", { target_project_id: projectId, flag: parsed.value.health, note: parsed.value.note });
  } else if (action === "lead") {
    const { leadId } = fields;
    if (leadId !== null && (typeof leadId !== "string" || !uuid.test(leadId))) return bad("Choose a staffed member.");
    call = (client) => client.rpc("set_project_lead", { target_project_id: projectId, expected_revision: revision as number, target_user: leadId });
  } else return bad("Unknown action.");

  const client = await createClient();
  const result = await call(client);
  if (result.error) {
    const mapped = mapRpcErrorVerbose(result.error, "Could not save. Reload to check the current record before retrying.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}
