import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";
import { onboardingRpc } from "@/app/applicant/onboarding-data";

const ITEMS = new Set(["CONTACT_CONFIRMATION", "ORIENTATION", "COMMUNICATIONS_CHANNEL", "PROFILE_SETUP", "BOARD_HANDOFF"]);

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = await readJsonBody(request, 8 * 1024);
  if (parsed.error || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const body = parsed.data as Record<string, unknown>;
  const cycleId = typeof body.cycleId === "string" ? body.cycleId : "";
  if (!user.memberships.some((membership) => membership.active && membership.cycleId === cycleId && ["BOARD", "OWNER"].includes(membership.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
  const itemKey = typeof body.itemKey === "string" ? body.itemKey : "";
  if (!applicationId || !ITEMS.has(itemKey)) return NextResponse.json({ error: "Invalid onboarding update" }, { status: 400 });
  const client = await createClient();
  const result = body.action === "SET_OWNER" && typeof body.value === "string"
    ? await onboardingRpc<boolean>(client, "set_member_onboarding_owner", { target_application_id: applicationId, target_item_key: itemKey, target_owner_id: body.value || null })
    : body.action === "SET_COMPLETION" && typeof body.value === "boolean"
      ? await onboardingRpc<boolean>(client, "set_member_onboarding_completion", { target_application_id: applicationId, target_item_key: itemKey, complete: body.value })
      : null;
  if (!result) return NextResponse.json({ error: "Invalid onboarding action" }, { status: 400 });
  if (result.error) {
    console.error("member onboarding update failed", result.error);
    const mapped = mapRpcError(result.error, "Could not update onboarding");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}
