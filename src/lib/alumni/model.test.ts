import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterListings, isContactEmail, isLinkedinUrl, listingFields, parseAlumniDirectory, parseListingInput, sharedFields, type AlumniListing } from "./model";

const form = { gradTerm: "Winter 2027", major: "IOE", employer: "Ford", jobTitle: "Analyst", location: "Detroit, MI", linkedinUrl: "https://www.linkedin.com/in/morgan", contactEmail: "morgan@example.invalid", note: "Operations roles." };
const listing: AlumniListing = { ...form, id: "l1", isMine: false, name: "Morgan Member", revision: 1, updatedAt: "2026-11-18T20:00:00Z" };

test("a listing form is trimmed and empty fields mean not shared", () => {
  const parsed = parseListingInput({ ...form, employer: "  Ford  ", jobTitle: "   ", note: "" });
  assert.deepEqual(parsed, { ok: true, value: { ...form, jobTitle: "", note: "" } });
  if (parsed.ok) assert.deepEqual(sharedFields(parsed.value), ["gradTerm", "major", "employer", "location", "linkedinUrl", "contactEmail"]);
  assert.equal(parseListingInput(Object.fromEntries(listingFields.map((field) => [field, ""]))).ok, true);
});

test("malformed or oversized forms are refused", () => {
  for (const input of [null, [], { ...form, phone: "555" }, { ...form, note: undefined }, { ...form, employer: 7 }, { ...form, gradTerm: "x".repeat(41) }, { ...form, note: "x".repeat(501) }]) {
    assert.equal(parseListingInput(input).ok, false, JSON.stringify(input));
  }
  const { note: _note, ...missing } = form;
  void _note;
  assert.equal(parseListingInput(missing).ok, false);
});

test("LinkedIn links and emails follow the database rules", () => {
  for (const good of ["https://www.linkedin.com/in/x", "https://LinkedIn.com/in/x", "https://uk.linkedin.com/in/x", "https://linkedin.com/"]) assert.equal(isLinkedinUrl(good), true, good);
  for (const bad of ["http://www.linkedin.com/in/x", "https://linkedin.com.evil.example/in/x", "https://evil.example/linkedin.com/in/x", "javascript:alert(1)", "https://linkedin.com/in/a b", `https://linkedin.com/${"x".repeat(300)}`]) assert.equal(isLinkedinUrl(bad), false, bad);
  assert.equal(isContactEmail("a@b.co"), true);
  for (const bad of ["a@b", "not an email", "a @b.co", "@b.co", "a@b.co?bcc=x@evil.test", "a@b.co,x@evil.test", "a@b.co&subject=x", "a%40b@c.co", "a@b.co;x@y.co", "<a@b.co>"]) assert.equal(isContactEmail(bad), false, bad);
  assert.equal(parseListingInput({ ...form, linkedinUrl: "https://example.com/in/x" }).ok, false);
  assert.equal(parseListingInput({ ...form, contactEmail: "nope" }).ok, false);
});

test("directory responses parse, and a bad link from storage is never linked", () => {
  const raw = { canRemoveOthers: true, mine: null, defaults: { gradTerm: "Winter 2027", major: "" }, entries: [listing, { ...listing, id: "l2", name: null, linkedinUrl: "javascript:alert(1)", contactEmail: "a@b.co?bcc=x@evil.test" }] };
  const parsed = parseAlumniDirectory(raw);
  assert.equal(parsed.canRemoveOthers, true);
  assert.equal(parsed.mine, null);
  assert.deepEqual(parsed.defaults, { gradTerm: "Winter 2027", major: "" });
  assert.equal(parsed.entries[1]!.linkedinUrl, "");
  assert.equal(parsed.entries[1]!.contactEmail, "", "a stored email that could inject mailto fields is not linked");
  assert.equal(parsed.entries[1]!.name, null);
  assert.deepEqual(parseAlumniDirectory({ ...raw, defaults: null, mine: listing }).defaults, { gradTerm: "", major: "" });
  for (const bad of [null, { ...raw, entries: null }, { ...raw, canRemoveOthers: "yes" }, { ...raw, entries: [{ ...listing, revision: 0 }] }, { ...raw, entries: [{ ...listing, employer: null }] }, { ...raw, mine: { ...listing, isMine: "true" } }]) {
    assert.throws(() => parseAlumniDirectory(bad), JSON.stringify(bad));
  }
});

test("search matches every word across name and shared details", () => {
  const other = { ...listing, id: "l2", name: "Alex Alum", employer: "Deloitte", location: "Chicago", gradTerm: "Winter 2025", note: "" };
  assert.deepEqual(filterListings([listing, other], "").map((entry) => entry.id), ["l1", "l2"]);
  assert.deepEqual(filterListings([listing, other], "  FORD detroit ").map((entry) => entry.id), ["l1"]);
  assert.deepEqual(filterListings([listing, other], "2025").map((entry) => entry.id), ["l2"]);
  assert.deepEqual(filterListings([listing, other], "alex").map((entry) => entry.id), ["l2"]);
  assert.deepEqual(filterListings([listing, other], "linkedin").map((entry) => entry.id), []);
});

test("the form's fields and limits match the migration", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261118210000_alumni_directory.sql", import.meta.url), "utf8");
  for (const field of listingFields) assert.match(sql, new RegExp(`'${field}'`), field);
  const keyList = /j not in \(([^)]*)\)/.exec(sql)?.[1];
  assert.deepEqual(keyList?.split(",").map((key) => key.trim().replace(/'/g, "")), [...listingFields]);
  for (const [column, limit] of [["grad_term", 40], ["major", 120], ["employer", 120], ["job_title", 120], ["location", 120], ["linkedin_url", 300], ["contact_email", 254], ["note", 500]] as const) {
    assert.match(sql, new RegExp(`char_length\\(${column}\\) <= ${limit}`), column);
  }
});
