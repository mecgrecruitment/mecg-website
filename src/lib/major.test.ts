import assert from "node:assert/strict";
import test from "node:test";
import { canonicalMajor } from "./major.ts";

test("every IOE spelling collapses to one label", () => {
  for (const raw of [
    "IOE",
    "Industrial and Operations Engineering",
    "Industrial & Operations Engineering",
    "Industrial Operations Engineering",
    "Industrial and Operations Engineering - Financial Conentration",
  ]) {
    assert.equal(canonicalMajor(raw), "Industrial and Operations Engineering");
  }
});

test("casing does not split a major", () => {
  assert.equal(canonicalMajor("Biomedical engineering"), "Biomedical Engineering");
  assert.equal(canonicalMajor("Biomedical Engineering"), "Biomedical Engineering");
});

test("a dual-degree parenthetical collapses to the base major", () => {
  assert.equal(
    canonicalMajor("Integrated Business and engineering (Dual degree in Business Administration and Mechanical Engineering)"),
    "Integrated Business and Engineering",
  );
});

test("an unknown major passes through as the applicant wrote it", () => {
  assert.equal(canonicalMajor("  Underwater Basket Weaving  "), "Underwater Basket Weaving");
});

test("empty and whitespace-only input return nothing", () => {
  assert.equal(canonicalMajor(""), "");
  assert.equal(canonicalMajor("   "), "");
});
