import { timingSafeEqual } from "node:crypto";

export function hasValidCronAuthorization(headers: Headers, expected: string): boolean {
  const presented = headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!presented) return false;
  const presentedBuffer = Buffer.from(presented);
  const expectedBuffer = Buffer.from(expected);
  return presentedBuffer.length === expectedBuffer.length
    && timingSafeEqual(presentedBuffer, expectedBuffer);
}
