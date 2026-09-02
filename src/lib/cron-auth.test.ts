import test from "node:test";
import assert from "node:assert/strict";
import { hasValidCronAuthorization } from "./cron-auth.ts";

const SECRET = "s".repeat(40);

test("cron authorization accepts only the exact bearer secret", () => {
  assert.equal(hasValidCronAuthorization(new Headers({ authorization: `Bearer ${SECRET}` }), SECRET), true);
  assert.equal(hasValidCronAuthorization(new Headers({ authorization: `bearer ${"x".repeat(40)}` }), SECRET), false);
  assert.equal(hasValidCronAuthorization(new Headers({ authorization: "Bearer short" }), SECRET), false);
  assert.equal(hasValidCronAuthorization(new Headers(), SECRET), false);
});
