import assert from "node:assert/strict";
import test from "node:test";
import { benefits } from "./catalog";
import { filterBenefits } from "./filter";

const defaults = { query: "", category: "", freeOnly: false, studentOnly: false };

test("search combines case-insensitive words with category and student filters", () => {
  const result = filterBenefits(benefits, { ...defaults, query: "  ADOBE   design ", category: "U-M benefits", studentOnly: true });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, "Adobe Creative Cloud at U-M");
  assert.equal(filterBenefits(benefits, { ...defaults, query: "no-such-resource-xyz" }).length, 0);
});

test("free filter does not promote blocked reads or ambiguous MATLAB entitlement", () => {
  const free = filterBenefits(benefits, { ...defaults, freeOnly: true });
  assert.ok(free.some((item) => item.name === "DataCamp GitHub student benefit"));
  assert.ok(!free.some((item) => ["blocked read", "limited read"].includes(item.evidence)));
  assert.ok(!free.some((item) => item.name === "MATLAB at U-M"));
  assert.match(free.find((item) => item.name === "GitKraken student benefit")?.terms ?? "", /paid renewal/);
});

test("catalog retains unique HTTPS provider links and explicit restrictions", () => {
  assert.equal(new Set(benefits.map((item) => item.id)).size, benefits.length);
  assert.equal(new Set(benefits.map((item) => item.url)).size, benefits.length);
  for (const item of benefits) {
    assert.equal(new URL(item.url).protocol, "https:");
    assert.ok(!/drive\.google\.com|docs\.google\.com/.test(item.url));
    assert.ok(item.terms && item.steps && item.checked);
  }
  assert.match(benefits.find((item) => item.name === "Qualtrics at U-M")?.terms ?? "", /non-U-M/);
});
