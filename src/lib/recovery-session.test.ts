import assert from "node:assert/strict";
import test from "node:test";
import { recoverySessionState } from "./recovery-session.ts";

function token(payload: unknown) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

const NOW = Math.floor(Date.now() / 1000);
const BASE = { sub: "11111111-1111-1111-1111-111111111111", aal: "aal1", exp: NOW + 3600, iat: NOW };

test("accepts a recovery-link session", () => {
  assert.equal(recoverySessionState(token({ ...BASE, amr: [{ method: "recovery", timestamp: NOW }] })), "recovery");
});

test("accepts the otp and magiclink shapes a recovery link can also produce", () => {
  assert.equal(recoverySessionState(token({ ...BASE, amr: [{ method: "otp", timestamp: NOW }] })), "recovery");
  assert.equal(recoverySessionState(token({ ...BASE, amr: ["magiclink"] })), "recovery");
});

test("rejects a plain password session, which is the stolen-cookie case", () => {
  assert.equal(recoverySessionState(token({ ...BASE, amr: [{ method: "password", timestamp: NOW }] })), "not-recovery");
  assert.equal(recoverySessionState(token({ ...BASE, amr: ["password", "oauth"] })), "not-recovery");
});

test("reports unknown when the amr claim is absent or unusable", () => {
  assert.equal(recoverySessionState(token(BASE)), "unknown");
  assert.equal(recoverySessionState(token({ ...BASE, amr: [] })), "unknown");
  assert.equal(recoverySessionState(token({ ...BASE, amr: "password" })), "unknown");
  assert.equal(recoverySessionState(token({ ...BASE, amr: [{ timestamp: NOW }] })), "unknown");
});

test("reports unknown for a malformed or missing token", () => {
  assert.equal(recoverySessionState(undefined), "unknown");
  assert.equal(recoverySessionState(""), "unknown");
  assert.equal(recoverySessionState("not-a-jwt"), "unknown");
  assert.equal(recoverySessionState("header..signature"), "unknown");
  assert.equal(recoverySessionState("header.bm90IGpzb24.signature"), "unknown");
});

test("leaves expiry to Supabase: an expired token is still judged on its amr", () => {
  const expired = { ...BASE, exp: NOW - 3600, iat: NOW - 7200 };
  assert.equal(recoverySessionState(token({ ...expired, amr: [{ method: "recovery", timestamp: NOW - 7200 }] })), "recovery");
  assert.equal(recoverySessionState(token({ ...expired, amr: [{ method: "password", timestamp: NOW - 7200 }] })), "not-recovery");
});
