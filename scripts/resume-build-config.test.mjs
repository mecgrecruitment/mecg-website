import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import nextConfig from "../next.config.ts";

test("the resume finalize deployment includes the PDF.js runtime worker", () => {
  assert.ok(nextConfig.serverExternalPackages?.includes("pdfjs-dist"));
  assert.deepEqual(nextConfig.outputFileTracingIncludes?.["/api/apply/resume/finalize"], [
    "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  ]);
  assert.equal(
    existsSync(new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url)),
    true,
    "the traced worker path must exist in the installed pdfjs-dist version",
  );
});
