import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { parseOffsetDateTime } from "@/lib/date-time";
import { deliverNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { applicantCode } from "@/lib/applicant-code";
import { parseReleasePreflight, parseReleaseSnapshot } from "@/lib/decision-release";
import type { Database } from "@/lib/supabase/database.types";

type DecisionOutcome = Database["rush"]["Enums"]["decision_outcome"];

const DECISION_OUTCOMES = new Set<DecisionOutcome>(["OFFER", "WAITLIST", "REJECT", "PROCEDURAL_REVIEW"]);
const DECISION_ACTIONS = new Set(["CREATE", "APPROVE", "RELEASE", "RELEASE_ALL", "RELEASE_PREFLIGHT", "SET_DEADLINE", "PREVIEW"]);
const DECISION_SCOPED_ACTIONS = new Set(["APPROVE", "RELEASE", "PREVIEW"]);
const RELEASE_ACTIONS = new Set(["RELEASE", "RELEASE_ALL", "RELEASE_PREFLIGHT"]);
// A reviewed release carries every decision, outcome and blocker in the cohort.
// Keep that snapshot intact while bounding both declared and streamed bodies.
const MAX_REQUEST_BYTES = 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedBody = await readJsonBody(req, MAX_REQUEST_BYTES);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  if (!DECISION_ACTIONS.has(action)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const supabase = await createClient();
  let cycleId = typeof body.cycleId === "string" ? body.cycleId : "";
  // Decision-scoped actions must re-derive the decision's real cycle from the DB:
  // trusting a client-supplied cycleId here would let a caller satisfy this app-layer check
  // against any cycle they hold DECIDE in, regardless of which cycle the target decision
  // actually belongs to. RELEASE_ALL and CREATE are cycle-scoped; SET_DEADLINE is scoped
  // directly to an application and therefore resolves that application's cycle instead.
  if (DECISION_SCOPED_ACTIONS.has(action)) {
    const { data: decision, error: decisionError } = await supabase.from("decisions").select("application_id").eq("id", String(body.decisionId ?? "")).maybeSingle();
    const { data: application, error: applicationError } = decision?.application_id
      ? await supabase.from("applications").select("cycle_id").eq("id", decision.application_id).maybeSingle()
      : { data: null, error: null };
    if (decisionError || applicationError) {
      console.error("decision cycle lookup failed", { code: (decisionError ?? applicationError)?.code ?? "unknown" });
      return NextResponse.json({ error: "Decision lookup is unavailable, try again" }, { status: 503 });
    }
    cycleId = application?.cycle_id ?? "";
  } else if (action === "SET_DEADLINE") {
    const applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
    if (!applicationId) return NextResponse.json({ error: "Application is required" }, { status: 400 });
    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .select("cycle_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (applicationError) {
      console.error("application cycle lookup failed", { code: applicationError.code ?? "unknown" });
      return NextResponse.json({ error: "Application lookup is unavailable, try again" }, { status: 503 });
    }
    cycleId = application?.cycle_id ?? "";
  }
  const allowed = hasPermission(user.memberships, cycleId, RELEASE_ACTIONS.has(action) ? "RELEASE" : "DECIDE");
  if (!cycleId || !allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let data: unknown;
  let proposedDeadline: { applicationId: string; expiresAt: string | null } | undefined;
  let error: { code?: string; message: string } | null = null;
  if (body?.action === "CREATE") {
    if (typeof body.outcome !== "string" || !DECISION_OUTCOMES.has(body.outcome as DecisionOutcome)) {
      return NextResponse.json({ error: "Invalid decision outcome" }, { status: 400 });
    }
    ({ data, error } = await supabase.rpc("create_decision", { target_cycle_id: String(body.cycleId ?? ""), target_application_id: String(body.applicationId ?? ""), target_outcome: body.outcome as DecisionOutcome, decision_reason: String(body.reason ?? "") }));
  } else if (body?.action === "APPROVE") ({ data, error } = await supabase.rpc("approve_decision", { target_decision_id: String(body.decisionId ?? "") }));
  else if (body?.action === "RELEASE") ({ data, error } = await supabase.rpc("release_decision", { target_decision_id: String(body.decisionId ?? "") }));
  else if (action === "RELEASE_PREFLIGHT") ({ data, error } = await supabase.rpc("decision_release_preflight", { target_cycle_id: cycleId }));
  else if (action === "RELEASE_ALL") {
    if ("snapshot" in body) {
      const snapshot = parseReleaseSnapshot(body.snapshot);
      if (!snapshot) return NextResponse.json({ error: "Invalid release snapshot. Review the cohort again." }, { status: 400 });
      ({ data, error } = await supabase.rpc("release_decision_batch", { target_cycle_id: cycleId, expected_decisions: snapshot }));
    } else {
      // Compatibility for existing aggregate clients; the reviewed UI always supplies a snapshot.
      ({ data, error } = await supabase.rpc("release_ready_decisions", { target_cycle_id: cycleId }));
    }
  }
  else if (body?.action === "SET_DEADLINE") {
    const expiresAt = body.expiresAt === "" ? null : parseOffsetDateTime(body.expiresAt);
    if (body.expiresAt !== "" && !expiresAt) return NextResponse.json({ error: "Invalid deadline" }, { status: 400 });
    proposedDeadline = { applicationId: String(body.applicationId), expiresAt: expiresAt ? expiresAt.toISOString() : null };
    ({ data, error } = await supabase.rpc("set_offer_deadline", {
      target_application_id: proposedDeadline.applicationId,
      expires_at: proposedDeadline.expiresAt,
    }));
  }
  else if (body?.action === "PREVIEW") ({ data, error } = await supabase.rpc("set_decision_preview", { target_decision_id: String(body.decisionId ?? ""), preview_text: String(body.preview ?? "") }));
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (error) {
    console.error("decision action failed", { action, code: error.code ?? "unknown" });
    if (action === "RELEASE_ALL" && error.code === "40001") {
      return NextResponse.json({ error: "The release cohort or readiness changed. Review the current outcomes before confirming again." }, { status: 409 });
    }
    const { body, status } = mapRpcError(error);
    return NextResponse.json(body, { status });
  }
  if (action === "SET_DEADLINE") {
    if (data !== true || !proposedDeadline) {
      return NextResponse.json({ error: "The deadline save could not be confirmed. Reload the current offer before another change." }, { status: 503 });
    }
    return NextResponse.json({ kind: "deadline-set", ...proposedDeadline });
  }
  if (action === "RELEASE_PREFLIGHT" || action === "RELEASE_ALL") {
    const result = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
    const items = parseReleasePreflight(result);
    const labels = items ? { applicantLabels: Object.fromEntries(items.map((item) => [item.applicationId, applicantCode(item.applicationId)])) } : {};
    return NextResponse.json({ ...result, ...labels, ...(action === "RELEASE_ALL" ? { delivery: "QUEUED" } : {}) }, { status: action === "RELEASE_ALL" ? 202 : 200 });
  }
  if (body.action === "RELEASE") {
    // release_decision committed the durable outbox row in the same transaction.
    // Delivery cannot roll business state back, and temporary failures remain queued.
    const { data: notificationId, error: notificationLookupError } = await supabase.rpc("decision_notification_id", {
      target_decision_id: String(body.decisionId ?? ""),
    });
    if (notificationLookupError || typeof notificationId !== "string") {
      console.error("released decision notification lookup failed", { code: notificationLookupError?.code ?? "missing_notification" });
      return NextResponse.json({ decisionId: String(body.decisionId), released: true, notified: false, queued: true }, { status: 202 });
    }
    try {
      const notification = await deliverNotification(createAdminClient(), notificationId);
      if (!notification.delivered) {
        return NextResponse.json(
          { decisionId: String(body.decisionId), released: true, notified: false, queued: notification.status === "PENDING" || notification.status === "NOT_DUE" },
          { status: 202 },
        );
      }
    } catch {
      console.error("release decision notification attempt failed", {
        decisionId: String(body.decisionId ?? ""),
        category: "notification_attempt_failed",
      });
      return NextResponse.json({ decisionId: String(body.decisionId), released: true, notified: false, queued: true }, { status: 202 });
    }
    return NextResponse.json({ decisionId: String(body.decisionId), released: true, notified: true, queued: false });
  }
  return NextResponse.json(data ?? { ok: true }, { status: body.action === "CREATE" ? 201 : 200 });
}
