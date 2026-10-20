import { NextRequest } from "next/server";
import { mapRpcError, rateLimitRouteResponse, readJsonBody, requestReference, routeJsonResponse } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { checkRateLimitStatus, clientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { parseApplicationDraftSnapshot, parseApplicationDraftSaveRequest, parseApplicationDraftSaveResult } from "@/app/apply/application-server-draft";

const MAX_REQUEST_BYTES = 64 * 1024;

type DraftRpc = (
  name: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;

function draftRpc(client: Awaited<ReturnType<typeof createClient>>) {
  return client.rpc.bind(client) as unknown as DraftRpc;
}

export async function GET(req: NextRequest) {
  const startedAt = performance.now();
  const requestId = requestReference(req);
  const respond = (body: Record<string, unknown>, status: number, code?: string) =>
    routeJsonResponse("application.draft.load", requestId, startedAt, body, status, {
      code,
      retryAfterSeconds: status === 503 ? 30 : undefined,
    });
  let user;
  try { user = await currentUser(); } catch {
    return respond({ error: "Sign-in services are temporarily unavailable. Try again shortly." }, 503, "AUTH_SERVICE_UNAVAILABLE");
  }
  if (!user) return respond({ error: "Sign in first" }, 401, "AUTH_REQUIRED");
  const supabase = await createClient();
  const { data, error } = await draftRpc(supabase)("application_draft");
  if (error) {
    const { body, status } = mapRpcError(error, "Could not load draft");
    return status >= 500
      ? respond({ error: "Draft service is temporarily unavailable. Try again shortly." }, 503, "SERVICE_UNAVAILABLE")
      : respond(body, status, "DRAFT_UNAVAILABLE");
  }
  if (data != null && !parseApplicationDraftSnapshot(data)) return respond({ error: "Draft service is temporarily unavailable. Keep your browser answers and try again shortly." }, 503, "INVALID_DRAFT_SNAPSHOT");
  return respond({ draft: data ?? null }, 200);
}

export async function POST(req: NextRequest) {
  const startedAt = performance.now();
  const requestId = requestReference(req);
  const respond = (body: Record<string, unknown>, status: number, code?: string) =>
    routeJsonResponse("application.draft.save", requestId, startedAt, body, status, {
      code,
      retryAfterSeconds: status === 503 ? 30 : undefined,
    });
  let user;
  try { user = await currentUser(); } catch {
    return respond({ error: "Sign-in services are temporarily unavailable. Try again shortly." }, 503, "AUTH_SERVICE_UNAVAILABLE");
  }
  if (!user) return respond({ error: "Sign in first" }, 401, "AUTH_REQUIRED");
  const parsedBody = await readJsonBody(req, MAX_REQUEST_BYTES);
  if (parsedBody.error === "too_large") {
    return respond({ error: "Draft payload is too large" }, 413, "PAYLOAD_TOO_LARGE");
  }
  if (parsedBody.error) {
    return respond({ error: "Invalid draft payload" }, 400, "INVALID_DRAFT");
  }
  const request = parseApplicationDraftSaveRequest(parsedBody.data);
  if (!request) return respond({ error: "Invalid draft payload" }, 400, "INVALID_DRAFT");
  const supabase = await createClient();
  const ip = clientIp(req);
  // Same both-buckets rule as /api/apply: the per-user key spares a shared NAT,
  // the IP-only key is the ceiling a per-account key cannot provide. Autosave
  // means far more requests per student, so the IP limit here is sized to the
  // sum of the per-user caps for a full hall
  // (supabase/migrations/20260902160000_apply_ip_rate_limit_ceiling.sql).
  const userLimit = await checkRateLimitStatus(`apply-draft:${user.id}:${ip}`);
  if (userLimit !== "allowed") return rateLimitRouteResponse("application.draft.save", requestId, startedAt, userLimit, undefined, 3600);
  const ipLimit = await checkRateLimitStatus(`apply-draft-ip:${ip}`);
  if (ipLimit !== "allowed") return rateLimitRouteResponse("application.draft.save", requestId, startedAt, ipLimit, undefined, 3600);
  const { data, error } = await draftRpc(supabase)("save_application_draft_v2", {
    payload: request.draft, expected_revision: request.expectedRevision,
    mutation_id: request.mutationId, cycle_id: request.cycleId,
  });
  if (error) {
    // save_application_draft raises 23505 when the applicant's email still
    // belongs to an account that can sign in. Generic "Could not save draft"
    // gives them nothing to do about it.
    if (error.code === "23505") return respond({ error: "This email is already linked to another account. Email mecg-board@umich.edu and we will merge them." }, 409, "APPLICANT_IDENTITY_CONFLICT");
    const { body: errorBody, status } = mapRpcError(error, "Could not save draft");
    return status >= 500
      ? respond({ error: "Draft service is temporarily unavailable. Try again shortly." }, 503, "SERVICE_UNAVAILABLE")
      : respond(errorBody, status, "DRAFT_REJECTED");
  }
  const result = parseApplicationDraftSaveResult(data);
  if (!result) return respond({ error: "Draft save could not be confirmed. Keep this page open and retry." }, 503, "INVALID_SAVE_RECEIPT");
  if (result.kind === "conflict") return respond({ error: "Your saved draft changed in another tab or device.", kind: "conflict", draft: result.snapshot ? { ...result.snapshot.draft, revision: result.snapshot.revision } : null }, 409, "DRAFT_REVISION_CONFLICT");
  return respond({ kind: "saved", revision: result.revision }, 200);
}
