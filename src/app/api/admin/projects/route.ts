import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedBody = await readJsonBody(req, 32 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const supabase = await createClient();

  // Projects are org-wide rather than cycle-scoped, so there is no cycle to
  // check a permission against here. Both RPCs require an active BOARD or
  // OWNER membership and re-check it themselves.
  let data: unknown;
  let error: { code?: string; message: string } | null = null;

  if (body.action === "SAVE") {
    if (!body.project || typeof body.project !== "object" || Array.isArray(body.project)) {
      return NextResponse.json({ error: "A project is required" }, { status: 400 });
    }
    ({ data, error } = await supabase.rpc("upsert_project", { project: body.project as Json }));
  } else if (body.action === "STAFF") {
    if (typeof body.projectId !== "string" || !body.projectId) {
      return NextResponse.json({ error: "A project is required" }, { status: 400 });
    }
    if (!Array.isArray(body.members)) {
      return NextResponse.json({ error: "Members must be a list" }, { status: 400 });
    }
    ({ data, error } = await supabase.rpc("set_project_staffing", { target_project_id: body.projectId, members: body.members as Json }));
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (error) {
    console.error("project action failed", error);
    const { body: errorBody, status } = mapRpcError(error, "Could not save the project");
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ ok: true, result: data ?? null });
}
