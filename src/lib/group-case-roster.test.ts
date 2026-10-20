import assert from "node:assert/strict";
import test from "node:test";
import { groupCaseQualityMessage, isGroupCaseRatingResult, type GroupCaseQuality } from "./group-case-roster.ts";
import { screeningRpc } from "./screening-rpc.ts";

const quality: GroupCaseQuality = { valid: false, coverage: 0, observedCount: 0, criteriaCount: 6, minimumObserved: 4, missingRequired: ["Collaboration"] };
const receipt = { kind: "saved", revision: "22222222-2222-4222-8222-222222222222", mutationId: "11111111-1111-4111-8111-111111111111", applicationId: "app", note: "Observed behavior", scores: { collaboration: null }, savedAt: "2026-10-16T20:00:00Z", quality };

test("note-only receipts keep null scores and the authoritative blockers", async () => {
  const result = await screeningRpc({ rpc: async () => ({ data: receipt, error: null }) }, "rate_group_case_applicant");
  assert.deepEqual(result.data, receipt);
  const message = groupCaseQualityMessage(quality);
  assert.match(message, /does not yet count/);
  assert.match(message, /0 of 4 minimum observations/);
  assert.match(message, /required: Collaboration/);
  assert.match(message, /0% weighted coverage; 75% needed/);
});

test("client trusts server validity rather than reproducing its predicate", () => {
  assert.equal(groupCaseQualityMessage({ ...quality, valid: true }), "Your review meets the grading requirements.");
  assert.match(groupCaseQualityMessage(undefined), /unavailable/);
  assert.match(groupCaseQualityMessage(null), /does not confirm/);
});

test("malformed quality cannot cross the RPC boundary", async () => {
  for (const invalid of [{ ...quality, valid: "true" }, { ...quality, coverage: Infinity }, { ...quality, missingRequired: [12] }, { ...quality, observedCount: -1 }, { ...quality, coverage: 1.1 }]) {
    const badReceipt = { ...receipt, quality: invalid };
    assert.equal(isGroupCaseRatingResult(badReceipt), false);
    const result = await screeningRpc({ rpc: async () => ({ data: badReceipt, error: null }) }, "rate_group_case_applicant");
    assert.equal(result.error?.code, "RPC_SHAPE");
  }
  assert.equal(isGroupCaseRatingResult({ ...receipt, quality: undefined }), true);
});
