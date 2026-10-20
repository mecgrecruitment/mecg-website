import { parseApplicationSubmissionReceipt } from "@/lib/application-submission";
import { NextRequest } from "next/server";
import { rateLimitRouteResponse, readJsonBody, requestReference, routeJsonResponse } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { scheduleApplicationReceiptDelivery } from "@/lib/application-receipt-delivery";
import { checkRateLimitStatus, clientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { parseApplicationIntake } from "@/lib/workflow";

import { isDraftRevision, parseApplicationDraftSaveResult } from "@/app/apply/application-server-draft";

const MAX_REQUEST_BYTES = 64 * 1024;

export async function POST(req: NextRequest) {
  const startedAt = performance.now();
  const requestId = requestReference(req);
  const respond = (body: Record<string, unknown>, status: number, code?: string) =>
    routeJsonResponse("application.submit", requestId, startedAt, body, status, { code });
  let user;
  try {
    user = await currentUser();
  } catch {
    return routeJsonResponse("application.submit", requestId, startedAt, { error: "Sign-in services are temporarily unavailable. Try again shortly." }, 503, {
      code: "AUTH_SERVICE_UNAVAILABLE",
      retryAfterSeconds: 30,
    });
  }
  if (!user) return respond({ error: "Sign in before applying" }, 401, "AUTH_REQUIRED");
  const parsedBody = await readJsonBody(req, MAX_REQUEST_BYTES);
  if (parsedBody.error === "too_large") {
    return respond({ error: "Application payload is too large" }, 413, "PAYLOAD_TOO_LARGE");
  }
  if (parsedBody.error) {
    return respond({ error: "Invalid application payload" }, 400, "INVALID_PAYLOAD");
  }
  const envelope = parsedBody.data;
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)
    || !("expectedRevision" in envelope) || !(envelope.expectedRevision === null || isDraftRevision(envelope.expectedRevision))
    || !("cycleId" in envelope) || typeof envelope.cycleId !== "string" || !envelope.cycleId || envelope.cycleId.length > 240) {
    return respond({ error: "Reload the application before submitting; your answers have been kept.", code: "DRAFT_PRECONDITION_REQUIRED" }, 400);
  }
  const { expectedRevision, cycleId, ...payload } = envelope;
  const intake = parseApplicationIntake(payload, user.email);
  if (!intake) {
    return respond({ error: "A valid name, resume, answers, and consent are required" }, 400, "INVALID_APPLICATION");
  }
  const supabase = await createClient();
  const ip = clientIp(req);
  // Two buckets, not one. The per-user key keeps a shared campus NAT from 429ing
  // a whole lecture hall, but it cannot be the ceiling: with user.id in the key
  // the IP is only a discriminator, so one host minting Clerk accounts gets one
  // full bucket per account. The IP-only bucket is the ceiling that survives
  // that (limits: supabase/migrations/20260902160000_apply_ip_rate_limit_ceiling.sql).
  const userLimit = await checkRateLimitStatus(`apply:${user.id}:${ip}`);
  if (userLimit !== "allowed") return rateLimitRouteResponse("application.submit", requestId, startedAt, userLimit, undefined, 3600);
  const ipLimit = await checkRateLimitStatus(`apply-ip:${ip}`);
  if (ipLimit !== "allowed") return rateLimitRouteResponse("application.submit", requestId, startedAt, ipLimit, undefined, 3600);
  const rpcArgs = {
    expected_revision: expectedRevision,
    cycle_id: cycleId,
    applicant_name: intake.name,
    applicant_contact: user.email,
    preferred_name: intake.preferredName ?? undefined,
    phone: intake.phone ?? undefined,
    class_year: intake.classYear,
    major: intake.major,
    linkedin_url: intake.linkedinUrl ?? undefined,
    resume_storage_path: intake.resumeStoragePath,
    answers: intake.answers,
    consent: true,
    uniqname: intake.uniqname,
    college: intake.college,
    grad_term: intake.gradTerm ?? undefined,
    accessibility_notes: intake.accessibilityNotes ?? undefined,
  };
  let rpcResult;
  try {
    // No fallback to a writer without a revision precondition.
    rpcResult = await supabase.rpc("submit_application_v2", rpcArgs);
  } catch {
    return routeJsonResponse("application.submit", requestId, startedAt, { error: "Submission services are temporarily unavailable. Try again shortly." }, 503, {
      code: "SERVICE_UNAVAILABLE",
      retryAfterSeconds: 30,
    });
  }
  const { data, error } = rpcResult;
  if (error) {
    if (error.code === "55000") return respond({ error: "Applications are no longer open." }, 409, "APPLICATIONS_CLOSED");
    if (error.code === "23505") return respond({ error: "This applicant identity is already linked to another account. Contact the recruitment team for help." }, 409, "APPLICANT_IDENTITY_CONFLICT");
    if (error.code === "42501") return respond({ error: "This account is not allowed to submit this application." }, 403, "APPLICATION_NOT_ALLOWED");
    if (error.code === "22023" && /resume/i.test(error.message ?? "")) {
      return respond({ error: "Your resume is missing or no longer valid. Upload it again." }, 400, "RESUME_INVALID");
    }
    if (error.code === "22023" && /(answer|question|selection)/i.test(error.message ?? "")) {
      return respond({ error: "Application questions changed. Review your responses and submit again." }, 400, "APPLICATION_ANSWERS_CHANGED");
    }
    if (error.code === "22023") return respond({ error: "Review the highlighted application details and submit again." }, 400, "INVALID_APPLICATION");
    return respond({ error: "An unexpected error occurred" }, 500, "SUBMISSION_FAILED");
  }
  const conflict = parseApplicationDraftSaveResult(data);
  if (conflict?.kind === "conflict") return respond({ kind: "conflict", draft: conflict.snapshot ? { ...conflict.snapshot.draft, revision: conflict.snapshot.revision } : null, error: "Your saved draft changed in another tab or device." }, 409, "DRAFT_REVISION_CONFLICT");
  const result = data;
  const applicationId = parseApplicationSubmissionReceipt(result);
  if (!result || typeof result !== "object" || Array.isArray(result) || !applicationId || typeof result.submittedNow !== "boolean") {
    return respond({ error: "An unexpected error occurred" }, 500, "INVALID_SUBMISSION_RESPONSE");
  }
  const { submittedNow } = result;
  if (submittedNow) scheduleApplicationReceiptDelivery({
    applicationId,
    applicantName: intake.name,
    recipient: user.email,
    durableOutbox: true,
  });
  return respond({ applicationId }, submittedNow ? 201 : 200);
}
