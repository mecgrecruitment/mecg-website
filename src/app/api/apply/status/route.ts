import { NextRequest } from "next/server";
import { requestReference, routeJsonResponse } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type SubmissionStatus = { applicationId: string; status: string; submitted: boolean };

function parseSubmissionStatus(value: unknown): SubmissionStatus | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.applicationId !== "string" || candidate.applicationId.length < 1 || candidate.applicationId.length > 100) return undefined;
  if (typeof candidate.status !== "string" || candidate.status.length < 1 || candidate.status.length > 40) return undefined;
  if (typeof candidate.submitted !== "boolean") return undefined;
  return { applicationId: candidate.applicationId, status: candidate.status, submitted: candidate.submitted };
}

export async function GET(req: NextRequest) {
  const startedAt = performance.now();
  const requestId = requestReference(req);
  const respond = (body: Record<string, unknown>, status: number, code?: string) => {
    const response = routeJsonResponse("application.status", requestId, startedAt, body, status, {
      code,
      retryAfterSeconds: status === 503 ? 30 : undefined,
    });
    response.headers.set("cache-control", "no-store");
    return response;
  };
  let user;
  try { user = await currentUser(); } catch {
    return respond({ error: "Sign-in services are temporarily unavailable. Try again shortly." }, 503, "AUTH_SERVICE_UNAVAILABLE");
  }
  if (!user) return respond({ error: "Sign in before checking your application" }, 401, "AUTH_REQUIRED");

  const cycleId = req.nextUrl.searchParams.get("cycleId");
  if (!cycleId || cycleId.length > 240) return respond({ error: "Reload the application before checking submission status." }, 400, "CYCLE_REQUIRED");
  const supabase = await createClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: "my_application_submission_status",
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  let result;
  try { result = await rpc("my_application_submission_status"); } catch {
    return respond({ error: "Application status is temporarily unavailable. Try again shortly." }, 503, "SERVICE_UNAVAILABLE");
  }
  if (result.error) return respond({ error: "Application status is temporarily unavailable. Try again shortly." }, 503, "SERVICE_UNAVAILABLE");
  const status = parseSubmissionStatus(result.data);
  if (status === undefined) return respond({ error: "Application status is temporarily unavailable. Try again shortly." }, 503, "INVALID_STATUS_RESPONSE");
  if (!status) return respond({ application: null }, 200);
  // The legacy status RPC returns the latest non-archived application. An older
  // cycle's submission must never clear recovery for the form being submitted.
  let match;
  try {
    match = await supabase.from("applications").select("id").eq("id", status.applicationId).eq("cycle_id", cycleId).maybeSingle();
  } catch { return respond({ error: "Application status is temporarily unavailable. Try again shortly." }, 503, "SERVICE_UNAVAILABLE"); }
  if (match.error) return respond({ error: "Application status is temporarily unavailable. Try again shortly." }, 503, "SERVICE_UNAVAILABLE");
  if (!match.data) return respond({ application: null }, 200);
  if (match.data.id !== status.applicationId) return respond({ error: "Application status is temporarily unavailable." }, 503, "INVALID_STATUS_RESPONSE");
  return respond({ application: { ...status, cycleId } }, 200);
}
