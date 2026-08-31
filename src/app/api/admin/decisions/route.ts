import { NextRequest, NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { sendEmail, wrapEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

function decisionEmail(outcome: string, name: string) {
  const cta = { label: "View your status", href: "https://mecgmichigan.com/applicant" };
  switch (outcome) {
    case "OFFER":
      return {
        subject: "Your MECG rush decision: offer",
        html: wrapEmail(
          `<p>Hi ${name},</p><p>Congratulations! MECG is excited to offer you a spot in our chapter. A board member will follow up with next steps soon.</p>`,
          cta,
        ),
      };
    case "REJECT":
      return {
        subject: "Your MECG rush decision",
        html: wrapEmail(
          `<p>Hi ${name},</p><p>Thank you for rushing MECG this cycle. After careful review, we're not able to extend an offer this semester. We appreciate the time you put in and hope you'll stay in touch.</p>`,
          cta,
        ),
      };
    case "WAITLIST":
      return {
        subject: "Your MECG rush decision: waitlist",
        html: wrapEmail(
          `<p>Hi ${name},</p><p>Thank you for rushing MECG. You've been placed on our waitlist, we'll reach out if a spot opens up.</p>`,
          cta,
        ),
      };
    default:
      return {
        subject: "Your MECG rush decision",
        html: wrapEmail(
          `<p>Hi ${name},</p><p>Your MECG rush application status has been updated. Reach out to the board with any questions.</p>`,
          cta,
        ),
      };
  }
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  if (!["CREATE", "APPROVE", "RELEASE", "PREVIEW"].includes(action)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const supabase = await createClient();
  let cycleId = typeof body?.cycleId === "string" ? body.cycleId : "";
  if (action !== "CREATE" && action !== "PREVIEW") {
    const { data: decision } = await supabase.from("decisions").select("application_id").eq("id", String(body.decisionId ?? "")).maybeSingle();
    const { data: application } = decision?.application_id
      ? await supabase.from("applications").select("cycle_id").eq("id", decision.application_id).maybeSingle()
      : { data: null };
    cycleId = application?.cycle_id ?? "";
  }
  const allowed = hasPermission(user.memberships, cycleId, action === "RELEASE" ? "RELEASE" : "DECIDE");
  if (!cycleId || !allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let data: unknown;
  let error: { code?: string; message: string } | null = null;
  if (body?.action === "CREATE") ({ data, error } = await supabase.rpc("create_decision", { target_cycle_id: String(body.cycleId ?? ""), target_application_id: String(body.applicationId ?? ""), target_outcome: body.outcome, decision_reason: String(body.reason ?? "") }));
  else if (body?.action === "APPROVE") ({ data, error } = await supabase.rpc("approve_decision", { target_decision_id: String(body.decisionId ?? "") }));
  else if (body?.action === "RELEASE") ({ data, error } = await supabase.rpc("release_decision", { target_decision_id: String(body.decisionId ?? "") }));
  else if (body?.action === "PREVIEW") ({ data, error } = await supabase.rpc("set_decision_preview", { target_decision_id: String(body.decisionId ?? ""), preview_text: String(body.preview ?? "") }));
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (error) {
    console.error("decision action failed", error);
    const { body, status } = mapRpcError(error);
    return NextResponse.json(body, { status });
  }
  if (body.action === "RELEASE") {
    const { data: released } = await supabase
      .from("decisions")
      .select("outcome, applications!inner(pnms!inner(name, contact))")
      .eq("id", String(body.decisionId ?? ""))
      .single();
    const pnm = released?.applications?.pnms;
    if (pnm) {
      const { subject, html } = decisionEmail(released.outcome, pnm.name);
      await sendEmail({ to: pnm.contact, subject, html });
    }
  }
  return NextResponse.json(data ?? { ok: true }, { status: body.action === "CREATE" ? 201 : 200 });
}
