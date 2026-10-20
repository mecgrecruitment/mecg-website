import assert from "node:assert/strict";
import test from "node:test";
import { contactErrors, parseContactErrors } from "./contact-validation";

test("contact receipt field errors allow only named string messages", () => {
  assert.deepEqual(parseContactErrors({ name: "Enter your name.", message: "Write more.", email: 42, unexpected: "ignored" }), { name: "Enter your name.", message: "Write more." });
  for (const value of [null, "error", [], [{ name: "Wrong shape" }]]) assert.deepEqual(parseContactErrors(value), {});
});

test("contact validation measures trimmed content consistently", () => {
  assert.deepEqual(contactErrors({ name: " Ada ", email: " ada@example.com ", subject: " A question ", message: " Enough meaningful text. " }), {});
  assert.deepEqual(Object.keys(contactErrors({ name: "   ", email: "invalid", subject: "Hello\nBcc", message: "          " })), ["name", "email", "subject", "message"]);
});
