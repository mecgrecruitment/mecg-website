import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";
import { onboardingRpc } from "../onboarding-data";

const SELF_ITEMS = new Set(["CONTACT_CONFIRMATION", "PROFILE_SETUP"]);

export async function POST(request: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = await readJsonBody(request, 8 * 1024);
  if (parsed.error || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const body = parsed.data as Record<string, unknown>;
  const applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
  const itemKey = typeof body.itemKey === "string" ? body.itemKey : "";
  if (!applicationId || !SELF_ITEMS.has(itemKey) || typeof body.complete !== "boolean") return NextResponse.json({ error: "Invalid onboarding update" }, { status: 400 });
  const result = await onboardingRpc<boolean>(await createClient(), "set_my_onboarding_item", { target_application_id: applicationId, target_item_key: itemKey, complete: body.complete });
  if (result.error) {
    console.error("set_my_onboarding_item failed", result.error);
    const mapped = mapRpcError(result.error, "Could not update onboarding");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}
