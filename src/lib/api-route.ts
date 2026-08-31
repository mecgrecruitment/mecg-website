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
};

export function mapRpcError(
  error: RpcError,
  fallback = "Request could not be completed",
): { body: { error: string }; status: number } {
  const status = error.code ? RPC_ERROR_STATUSES[error.code] : undefined;
  if (status) return { body: { error: fallback }, status };
  return { body: { error: "An unexpected error occurred" }, status: 500 };
}
