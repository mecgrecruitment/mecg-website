import { randomUUID } from "node:crypto";
import { operationalLog } from "@/lib/operational-log";

type RpcError = { code?: string; message?: string };

export type JsonBodyResult =
  | { data: unknown; error?: never }
  | { data?: never; error: "invalid_json" | "too_large" };

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<JsonBodyResult> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { error: "too_large" };
  }

  const reader = request.body?.getReader();
  if (!reader) return { error: "invalid_json" };

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { error: "too_large" };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { data: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { error: "invalid_json" };
  }
}

const RPC_ERROR_STATUSES: Record<string, number> = {
  "22023": 400,
  "22P02": 400,
  "42501": 403,
  P0002: 404,
  "55000": 409,
  "23505": 409,
  "23514": 400,
  // Raised by RPCs that enforce their own throttle because they are reachable
  // directly through PostgREST, bypassing the route handler's rate limit.
  "53400": 429,
};

export function mapRpcError(
  error: RpcError,
  fallback = "Request could not be completed",
): { body: { error: string }; status: number } {
  const status = error.code ? RPC_ERROR_STATUSES[error.code] : undefined;
  if (status) return { body: { error: fallback }, status };
  return { body: { error: "An unexpected error occurred" }, status: 500 };
}

// Codes whose message is written for the person acting (RAISE ... USING ERRCODE
// in a rush RPC), so a route may surface it instead of the generic fallback.
const VERBOSE_RPC_CODES = new Set(["22023", "55000", "42501"]);

export function mapRpcErrorVerbose(
  error: RpcError,
  fallback?: string,
): { body: { error: string }; status: number } {
  const mapped = mapRpcError(error, fallback);
  const message = error.message?.trim();
  if (error.code && VERBOSE_RPC_CODES.has(error.code) && message) return { ...mapped, body: { error: message } };
  return mapped;
}

export function requestReference(request: { headers: Headers }): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
}

type RouteResponseOptions = {
  code?: string;
  retryAfterSeconds?: number;
  detail?: Record<string, string | number | boolean | null>;
};

export function routeJsonResponse(
  event: string,
  requestId: string,
  startedAt: number,
  body: Record<string, unknown>,
  status: number,
  options: RouteResponseOptions = {},
): Response {
  const durationMs = performance.now() - startedAt;
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
  operationalLog(level, {
    event,
    requestId,
    code: options.code,
    durationMs,
    detail: { status, ...options.detail },
  });
  const headers = new Headers({ "x-request-id": requestId });
  if (options.retryAfterSeconds) headers.set("retry-after", String(options.retryAfterSeconds));
  return Response.json(
    options.code ? { ...body, code: options.code, reference: requestId } : body,
    { status, headers },
  );
}

export function rateLimitRouteResponse(
  event: string,
  requestId: string,
  startedAt: number,
  status: "limited" | "unavailable",
  limitedMessage = "Too many requests. Wait a minute and try again.",
  retryAfterSeconds = 60,
) {
  return status === "limited"
    ? routeJsonResponse(event, requestId, startedAt, { error: limitedMessage }, 429, {
        code: "RATE_LIMITED",
        retryAfterSeconds,
      })
    : routeJsonResponse(event, requestId, startedAt, { error: "This service is temporarily unavailable. Try again shortly." }, 503, {
        code: "SERVICE_UNAVAILABLE",
        retryAfterSeconds: 30,
      });
}

export function authServiceUnavailableResponse() {
  return Response.json(
    {
      error: "Sign-in services are temporarily unavailable. Try again shortly.",
      code: "AUTH_SERVICE_UNAVAILABLE",
    },
    { status: 503, headers: { "retry-after": "30" } },
  );
}
