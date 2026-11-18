import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";
import { feedbackLink, parseLinkResponse } from "@/lib/engagement/closeout";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

// Board-only feedback link management. The database checks board access in
// the chosen cycle, that the project is Closed and that its lead can own the
// draft evidence. Nothing here sends the link anywhere: it is returned once
// to the board member, who passes it to the client.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.memberships.some((membership) => membership.active)) return NextResponse.json({ error: "Membership required." }, { status: 403 });
  const body = await readJsonBody(request, 4 * 1024);
  if (body.error || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) return bad("Invalid form.");
  const { action, projectId, cycleId } = body.data as Record<string, unknown>;
  if (typeof projectId !== "string" || !projectId || projectId.length > 100) return bad("Choose a project.");
  if (action !== "create" && action !== "revoke") return bad("Unknown action.");
  if (action === "create" && (typeof cycleId !== "string" || !cycleId || cycleId.length > 100)) return bad("Choose a cycle.");

  const client = await createClient();
  if (action === "create") {
    const { data, error } = await client.rpc("create_client_feedback_link", { target_project_id: projectId, target_cycle_id: cycleId as string });
    if (error) {
      const mapped = mapRpcErrorVerbose(error, "Could not create the link. Reload and try again.");
      return NextResponse.json(mapped.body, { status: mapped.status });
    }
    const link = parseLinkResponse(data);
    if (!link) return NextResponse.json({ error: "The link could not be confirmed. Reload, then create a new one." }, { status: 502 });
    return NextResponse.json({ ok: true, link: feedbackLink(new URL(request.url).origin, link.token), expiresAt: link.expiresAt });
  }
  const { error } = await client.rpc("revoke_client_feedback_link", { target_project_id: projectId });
  if (error) {
    const mapped = mapRpcErrorVerbose(error, "Could not cancel the link. Reload and try again.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}
