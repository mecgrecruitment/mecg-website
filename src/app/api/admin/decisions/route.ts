import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { deliverNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type DecisionOutcome = Database["rush"]["Enums"]["decision_outcome"];

const DECISION_OUTCOMES = new Set<DecisionOutcome>(["OFFER", "WAITLIST", "REJECT", "PROCEDURAL_REVIEW"]);

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedBody = await readJsonBody(req, 16 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  if (!["CREATE", "APPROVE", "RELEASE", "PREVIEW"].includes(action)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const supabase = await createClient();
  let cycleId = typeof body.cycleId === "string" ? body.cycleId : "";
  // PREVIEW must re-derive the decision's real cycle from the DB, same as APPROVE/RELEASE:
  // trusting a client-supplied cycleId here would let a caller satisfy this app-layer check
  // against any cycle they hold DECIDE in, regardless of which cycle the target decision
  // actually belongs to. Only CREATE has no existing decisionId to look the cycle up from.
  if (action !== "CREATE") {
    const { data: decision, error: decisionError } = await supabase.from("decisions").select("application_id").eq("id", String(body.decisionId ?? "")).maybeSingle();
    const { data: application, error: applicationError } = decision?.application_id
      ? await supabase.from("applications").select("cycle_id").eq("id", decision.application_id).maybeSingle()
      : { data: null, error: null };
    if (decisionError || applicationError) {
      console.error("decision cycle lookup failed", decisionError ?? applicationError);
      return NextResponse.json({ error: "Decision lookup is unavailable, try again" }, { status: 503 });
    }
    cycleId = application?.cycle_id ?? "";
  }
  const allowed = hasPermission(user.memberships, cycleId, action === "RELEASE" ? "RELEASE" : "DECIDE");
  if (!cycleId || !allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let data: unknown;
  let error: { code?: string; message: string } | null = null;
  if (body?.action === "CREATE") {
    if (typeof body.outcome !== "string" || !DECISION_OUTCOMES.has(body.outcome as DecisionOutcome)) {
      return NextResponse.json({ error: "Invalid decision outcome" }, { status: 400 });
    }
    ({ data, error } = await supabase.rpc("create_decision", { target_cycle_id: String(body.cycleId ?? ""), target_application_id: String(body.applicationId ?? ""), target_outcome: body.outcome as DecisionOutcome, decision_reason: String(body.reason ?? "") }));
  } else if (body?.action === "APPROVE") ({ data, error } = await supabase.rpc("approve_decision", { target_decision_id: String(body.decisionId ?? "") }));
  else if (body?.action === "RELEASE") ({ data, error } = await supabase.rpc("release_decision", { target_decision_id: String(body.decisionId ?? "") }));
  else if (body?.action === "RELEASE_ALL") ({ data, error } = await supabase.rpc("release_ready_decisions", { target_cycle_id: String(body.cycleId ?? "") }));
  else if (body?.action === "SET_DEADLINE") {
    const expiresAt = typeof body.expiresAt === "string" && body.expiresAt ? new Date(body.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) return NextResponse.json({ error: "Invalid deadline" }, { status: 400 });
    ({ data, error } = await supabase.rpc("set_offer_deadline", {
      target_application_id: String(body.applicationId ?? ""),
      expires_at: expiresAt ? expiresAt.toISOString() : null as unknown as string,
    }));
  }
  else if (body?.action === "PREVIEW") ({ data, error } = await supabase.rpc("set_decision_preview", { target_decision_id: String(body.decisionId ?? ""), preview_text: String(body.preview ?? "") }));
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (error) {
    console.error("decision action failed", error);
    const { body, status } = mapRpcError(error);
    return NextResponse.json(body, { status });
  }
  if (body.action === "RELEASE") {
    // release_decision committed the durable outbox row in the same transaction.
    // Delivery cannot roll business state back, and temporary failures remain queued.
    const { data: notificationId, error: notificationLookupError } = await supabase.rpc("decision_notification_id", {
      target_decision_id: String(body.decisionId ?? ""),
    });
    if (notificationLookupError || typeof notificationId !== "string") {
      console.error("released decision notification lookup failed", notificationLookupError);
      return NextResponse.json({ released: true, notified: false, queued: true }, { status: 202 });
    }
    try {
      const notification = await deliverNotification(createAdminClient(), notificationId);
      if (!notification.delivered) {
        return NextResponse.json(
          { released: true, notified: false, queued: notification.status === "PENDING" || notification.status === "NOT_DUE" },
          { status: 202 },
        );
      }
    } catch (notificationError) {
      console.error("release decision notification attempt failed", {
        decisionId: String(body.decisionId ?? ""),
        category: notificationError instanceof Error ? notificationError.message : "unknown",
      });
      return NextResponse.json({ released: true, notified: false, queued: true }, { status: 202 });
    }
  }
  return NextResponse.json(data ?? { ok: true }, { status: body.action === "CREATE" ? 201 : 200 });
}
