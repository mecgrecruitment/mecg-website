// design-owner: client:mecg because it tests the MECG workspace consulting hub.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptHub, encryptHub, hubFileBytes, packHub, parseHubKey, type HubDoc } from "./format.ts";
import { renderMarkdown } from "./render.ts";
import { hubEntries, searchHub } from "./catalog.ts";
import { hubDocHref, hubFileHref } from "./paths.ts";

// Synthetic fixtures only: real hub content must never appear in this public repository.
const doc = (overrides: Partial<HubDoc>): HubDoc => ({
  slug: "drafts/example/readme",
  title: "Example campaign",
  sectionId: "campaigns",
  folder: "board/consulting/drafts/example",
  sourcePath: "board/consulting/drafts/example/README.md",
  updated: "2026-11-17",
  html: "<p>Example</p>",
  text: "Example",
  ...overrides,
});

function sampleBundle() {
  const docs = [
    doc({}),
    doc({ slug: "drafts/example/outreach", title: "Outreach drafts", sourcePath: "board/consulting/drafts/example/outreach.md", text: "Pricing stays out of writing" }),
    doc({ slug: "drafts/loose-research", title: "Loose research", folder: "board/consulting/drafts", sourcePath: "board/consulting/drafts/loose-research.md", sectionId: "prospects", text: "Acme Widgets ranked first" }),
  ];
  const contents = [Buffer.from("%PDF-1.7 fake"), Buffer.from("<html><body>dash</body></html>")];
  const files = [
    { id: "aaaa", name: "brief.pdf", sectionId: "campaigns", folder: "board/consulting/drafts/example/kit/output", sourcePath: "board/consulting/drafts/example/kit/output/brief.pdf", mime: "application/pdf", inline: true, sandbox: false },
    { id: "bbbb", name: "dashboard.html", sectionId: "prospects", folder: "board/consulting/drafts", sourcePath: "board/consulting/drafts/dashboard.html", mime: "text/html; charset=utf-8", inline: true, sandbox: true },
  ];
  const container = packHub({ version: 1, title: "Hub", generatedAt: "2026-11-18T00:00:00Z", overviewHtml: "<p>hi</p>", sections: [], docs, files }, contents);
  return { container, contents };
}

test("the hub round-trips through encryption and returns each file's exact bytes", () => {
  const key = randomBytes(32);
  const { container, contents } = sampleBundle();
  const bundle = decryptHub(encryptHub(container, key), key);
  assert.equal(bundle.manifest.docs.length, 3);
  assert.deepEqual(hubFileBytes(bundle, bundle.manifest.files[0]), contents[0]);
  assert.deepEqual(hubFileBytes(bundle, bundle.manifest.files[1]), contents[1]);
});

test("the ciphertext reveals nothing and a wrong or tampered key is refused", () => {
  const key = randomBytes(32);
  const { container } = sampleBundle();
  const encrypted = encryptHub(container, key);
  assert.equal(encrypted.includes(Buffer.from("Acme Widgets")), false);
  assert.equal(encrypted.includes(Buffer.from("Example campaign")), false);
  assert.throws(() => decryptHub(encrypted, randomBytes(32)));
  const tampered = Buffer.from(encrypted);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decryptHub(tampered, key));
});

test("only a base64 32-byte key is accepted", () => {
  assert.equal(parseHubKey(undefined), null);
  assert.equal(parseHubKey(""), null);
  assert.equal(parseHubKey(randomBytes(16).toString("base64")), null);
  assert.equal(parseHubKey(` ${randomBytes(32).toString("base64")}\n`)?.length, 32);
});

test("markdown keeps safe links, rewrites hub links and escapes raw HTML", () => {
  const { html, title, text } = renderMarkdown(
    [
      "# Plan title",
      "<script>alert(1)</script>",
      "[site](https://example.com) [mail](mailto:a@example.com) [hub](plan.md) [bad](javascript:alert(1)) [jump](#plan-title)",
      "| A | B |\n| --- | --- |\n| 1 | 2 |",
    ].join("\n\n"),
    (href) => (href === "plan.md" ? { href: hubDocHref("drafts/plan"), external: false } : href.startsWith("http") || href.startsWith("mailto") ? { href, external: true } : null),
  );
  assert.equal(title, "Plan title");
  assert.match(html, /<h1 id="plan-title">Plan title<\/h1>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">site<\/a>/);
  assert.match(html, /<a href="\/admin\/consulting\/drafts\/plan">hub<\/a>/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /<span class="consulting-doc-unlinked" title="Not in the hub">bad<\/span>/);
  assert.match(html, /<a href="#plan-title">jump<\/a>/);
  assert.match(html, /<div class="consulting-doc-table"><table>/);
  assert.match(text, /Plan title/);
});

test("documents and files group under the nearest folder with a README", () => {
  const { container } = sampleBundle();
  const key = randomBytes(32);
  const { manifest } = decryptHub(encryptHub(container, key), key);
  const [campaign] = hubEntries(manifest, "campaigns");
  assert.equal(campaign.title, "Example campaign");
  assert.equal(campaign.href, hubDocHref("drafts/example/readme"));
  assert.deepEqual(campaign.docs.map((item) => item.title), ["Outreach drafts"]);
  assert.deepEqual(campaign.files.map((item) => item.name), ["brief.pdf"]);
  const prospects = hubEntries(manifest, "prospects");
  assert.deepEqual(prospects.map((entry) => entry.title), ["Loose research", "dashboard.html"]);
  assert.equal(prospects[1].href, hubFileHref("bbbb", "dashboard.html"));
});

test("search needs every word and ranks title matches first", () => {
  const { container } = sampleBundle();
  const key = randomBytes(32);
  const { manifest } = decryptHub(encryptHub(container, key), key);
  assert.deepEqual(searchHub(manifest, "pricing writing").map((result) => result.kind === "doc" && result.doc.title), ["Outreach drafts"]);
  assert.deepEqual(searchHub(manifest, "pricing acme"), []);
  assert.equal(searchHub(manifest, "dashboard")[0].kind, "file");
  assert.deepEqual(searchHub(manifest, "  "), []);
});
