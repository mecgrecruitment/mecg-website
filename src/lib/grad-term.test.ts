import assert from "node:assert/strict";
import test from "node:test";
import { formatGradTerm, gradTermBaseYear, gradTermFromSelection, gradYearOptions, parseGradTerm } from "./grad-term.ts";

test("parses the stored format the admin directory already shows", () => {
  assert.deepEqual(parseGradTerm("Winter 2028"), { term: "Winter", year: 2028 });
  assert.deepEqual(parseGradTerm("  fall   2027 "), { term: "Fall", year: 2027 });
});

test("formatting a parsed term round-trips to the stored string", () => {
  for (const value of ["Winter 2028", "Spring 2027", "Summer 2030", "Fall 2026"]) {
    assert.equal(formatGradTerm(parseGradTerm(value)!), value);
  }
});

test("free text that is not a term and year stays unparsed", () => {
  for (const value of ["", "May 2028", "Winter '28", "W28", "Fall 2027 maybe", "2028"]) {
    assert.equal(parseGradTerm(value), null, value);
  }
});

test("year options run from the base year through six years out", () => {
  assert.deepEqual(gradYearOptions(2026, null), [2026, 2027, 2028, 2029, 2030, 2031, 2032]);
});

test("a saved year outside the window stays selectable", () => {
  assert.deepEqual(gradYearOptions(2026, 2024), [2024, 2026, 2027, 2028, 2029, 2030, 2031, 2032]);
  assert.deepEqual(gradYearOptions(2026, 2028), [2026, 2027, 2028, 2029, 2030, 2031, 2032]);
});

test("base year follows Ann Arbor, not UTC, at New Year", () => {
  assert.equal(gradTermBaseYear(new Date("2027-01-01T03:00:00Z")), 2026);
  assert.equal(gradTermBaseYear(new Date("2027-01-01T06:00:00Z")), 2027);
});

test("picking both a term and a year saves the structured term", () => {
  assert.deepEqual(gradTermFromSelection("Fall", "2027", ""), { value: "Fall 2027", partial: false });
  assert.deepEqual(gradTermFromSelection("Winter", "2029", "May 2028"), { value: "Winter 2029", partial: false });
});

test("a half-picked selection keeps the saved value instead of wiping it", () => {
  assert.deepEqual(gradTermFromSelection("", "2027", "Fall 2027"), { value: "Fall 2027", partial: true });
  assert.deepEqual(gradTermFromSelection("Spring", "", "May 2028"), { value: "May 2028", partial: true });
  assert.deepEqual(gradTermFromSelection("Spring", "", ""), { value: "", partial: true });
});

test("blanking both selects clears the optional field, free text included", () => {
  assert.deepEqual(gradTermFromSelection("", "", "May 2028"), { value: "", partial: false });
  assert.deepEqual(gradTermFromSelection("", "", "Fall 2027"), { value: "", partial: false });
});
