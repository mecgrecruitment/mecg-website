type OperationalLevel = "info" | "warn" | "error";

type OperationalEvent = {
  event: string;
  requestId?: string;
  cycleId?: string;
  resource?: string;
  resourceId?: string;
  code?: string;
  durationMs?: number;
  detail?: Record<string, string | number | boolean | null>;
};

function cleanText(value: string, maxLength = 160) {
  return value.replace(/[\r\n\t]/g, " ").slice(0, maxLength);
}

function cleanEvent(input: OperationalEvent) {
  return {
    event: cleanText(input.event, 80),
    ...(input.requestId ? { requestId: cleanText(input.requestId, 100) } : {}),
    ...(input.cycleId ? { cycleId: cleanText(input.cycleId, 100) } : {}),
    ...(input.resource ? { resource: cleanText(input.resource, 80) } : {}),
    ...(input.resourceId ? { resourceId: cleanText(input.resourceId, 100) } : {}),
    ...(input.code ? { code: cleanText(input.code, 80) } : {}),
    ...(typeof input.durationMs === "number" && Number.isFinite(input.durationMs)
      ? { durationMs: Math.max(0, Math.round(input.durationMs)) }
      : {}),
    ...(input.detail
      ? {
          detail: Object.fromEntries(
            Object.entries(input.detail).slice(0, 20).map(([key, value]) => [
              cleanText(key, 60),
              typeof value === "string" ? cleanText(value) : value,
            ]),
          ),
        }
      : {}),
  };
}

// Vercel and most log drains parse one JSON object per line. Keep the payload
// deliberately small and accept only operational metadata, never free-form
// request bodies, application answers, tokens, or document contents.
export function operationalLog(level: OperationalLevel, input: OperationalEvent) {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "mecg-recruitment",
    ...cleanEvent(input),
  });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}
