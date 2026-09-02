import assert from "node:assert/strict";
import test from "node:test";
import {
  CLERK_PASSWORD_MAX_LENGTH,
  CLERK_PASSWORD_MIN_LENGTH,
  hasValidClerkPasswordLength,
} from "./clerk-password.ts";

test("matches the Clerk production password length policy", () => {
  assert.equal(CLERK_PASSWORD_MIN_LENGTH, 8);
  assert.equal(hasValidClerkPasswordLength("a".repeat(CLERK_PASSWORD_MIN_LENGTH - 1)), false);
  assert.equal(hasValidClerkPasswordLength("a".repeat(CLERK_PASSWORD_MIN_LENGTH)), true);
  assert.equal(hasValidClerkPasswordLength("a".repeat(CLERK_PASSWORD_MAX_LENGTH)), true);
  assert.equal(hasValidClerkPasswordLength("a".repeat(CLERK_PASSWORD_MAX_LENGTH + 1)), false);
});
