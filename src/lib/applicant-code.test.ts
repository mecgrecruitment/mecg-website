import test from "node:test";
import assert from "node:assert/strict";
import { applicantCode } from "./applicant-code.ts";

test("applicant code is deterministic and formatted like a candidate code", () => {
  const code = applicantCode("11111111-1111-1111-1111-111111111111");
  assert.equal(code, applicantCode("11111111-1111-1111-1111-111111111111"));
  assert.match(code, /^Applicant [0-9A-F]{6}$/);
});

test("applicant code differs across applications and never contains the id", () => {
  const a = applicantCode("11111111-1111-1111-1111-111111111111");
  const b = applicantCode("22222222-2222-2222-2222-222222222222");
  assert.notEqual(a, b);
  assert.equal(a.includes("11111111"), false);
});
