import { NextRequest } from "next/server";
import { mapRpcError, rateLimitRouteResponse, readJsonBody, requestReference, routeJsonResponse } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { checkRateLimitStatus, clientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { parseApplicationServerDraft } from "@/app/apply/application-server-draft";

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
  const draft = parseApplicationServerDraft(parsedBody.data);
  if (!draft) return respond({ error: "Invalid draft payload" }, 400, "INVALID_DRAFT");
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
  const { error } = await supabase.rpc("save_application_draft", { payload: draft });
  if (error) {
    const { body: errorBody, status } = mapRpcError(error, "Could not save draft");
    return status >= 500
      ? respond({ error: "Draft service is temporarily unavailable. Try again shortly." }, 503, "SERVICE_UNAVAILABLE")
      : respond(errorBody, status, "DRAFT_REJECTED");
  }
  return respond({ ok: true }, 200);
}
