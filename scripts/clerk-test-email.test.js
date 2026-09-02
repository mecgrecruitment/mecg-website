import test from "node:test";
import assert from "node:assert/strict";
import { clerkTestEmail } from "./lib/clerk-test-email.mjs";

test("Clerk fixtures use the documented non-delivery test subaddress", () => {
  assert.equal(
    clerkTestEmail("Workflow Owner", "12345678-90ab-cdef"),
    "workflow-owner+clerk_test_1234567890ab@example.com",
  );
});

test("Clerk fixture addresses stay within email local-part limits", () => {
  const email = clerkTestEmail("A label that is deliberately far too long to be an email prefix", "abcdef1234567890");
  assert.ok(email.split("@")[0].length <= 64);
});
