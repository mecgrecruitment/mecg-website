import assert from "node:assert/strict";
import test from "node:test";
import { applicantDossierHref, filterDossierNavigationRows, validateRecruitmentReturnTo, type DossierNavigationRow } from "./dossier-navigation";

test("keeps Recruitment filters, search, view, and hash in a same-origin return path", () => {
  const value = "/admin?view=ALL&filter=ELIGIBLE&search=ada#applicants";
  assert.equal(validateRecruitmentReturnTo(value), value);
  assert.equal(
    applicantDossierHref("application/1", value),
    "/admin/applications/application%2F1?returnTo=%2Fadmin%3Fview%3DALL%26filter%3DELIGIBLE%26search%3Dada%23applicants",
  );
});

test("rejects external, protocol-relative, malformed, and non-Recruitment destinations", () => {
  for (const value of [
    "https://evil.example/admin",
    "//evil.example/admin",
    "/\\evil.example/admin",
    "/admin/messages",
    "/member",
    "javascript:alert(1)",
    ["/admin", "/admin?filter=ELIGIBLE"],
  ]) {
    assert.equal(validateRecruitmentReturnTo(value), "/admin");
  }
});

test("previous and next navigation stays inside the originating roster filters", () => {
  const rows: DossierNavigationRow[] = [
    { id: "one", submitted_at: "2026-01-01", status: "ELIGIBLE", resume_storage_path: "one.pdf", pnms: { name: "Ada Lovelace", contact: "ada@example.com" } },
    { id: "two", submitted_at: "2026-01-02", status: "INVITED", resume_storage_path: "two.pdf", pnms: { name: "Grace Hopper", contact: "grace@example.com" } },
    { id: "three", submitted_at: "2026-01-03", status: "ELIGIBLE", resume_storage_path: null, pnms: { name: "Ada Byron", contact: "byron@example.com" } },
  ];

  assert.deepEqual(
    filterDossierNavigationRows(rows, "/admin?filter=ELIGIBLE&resume=ON_FILE&query=ada"),
    [rows[0]],
  );

  assert.deepEqual(
    filterDossierNavigationRows(rows, "/admin?view=PIPELINE&filter=INVITED&resume=MISSING"),
    rows,
  );

  const withDecided: DossierNavigationRow[] = [
    ...rows,
    { id: "four", submitted_at: "2026-01-04", status: "REJECTED", resume_storage_path: null, pnms: { name: "Ada King", contact: "king@example.com" } },
  ];
  assert.deepEqual(
    filterDossierNavigationRows(withDecided, "/admin?view=PIPELINE&query=ada"),
    [rows[0], rows[2]],
  );
  assert.deepEqual(
    filterDossierNavigationRows(withDecided, "/admin?view=PIPELINE&query=ada&decided=1"),
    [rows[0], rows[2], withDecided[3]],
  );
});
