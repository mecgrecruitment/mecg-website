import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { AlumniDirectory, AlumniListing } from "@/lib/alumni/model";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
type LoadHook = (url: string, context: unknown, nextLoad: (url: string, context: unknown) => LoadResult) => LoadResult;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { load: LoadHook }) => void };
// node --test cannot compile JSX, so transpile .tsx with the repo's TypeScript.
registerHooks({
  load(url, context, nextLoad) {
    const path = url.split("?")[0]!;
    if (!path.endsWith(".tsx")) return nextLoad(url, context);
    const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(path), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    });
    return { format: "module", shortCircuit: true, source: outputText };
  },
});

const morgan: AlumniListing = { id: "l1", isMine: false, name: "Morgan Member", gradTerm: "Winter 2027", major: "IOE", employer: "Ford", jobTitle: "Analyst", location: "Detroit, MI", linkedinUrl: "https://www.linkedin.com/in/morgan", contactEmail: "morgan@example.invalid", note: "Operations roles.", revision: 2, updatedAt: "2026-11-18T20:00:00Z" };
const alex: AlumniListing = { ...morgan, id: "l2", name: "Alex Alum", employer: "", jobTitle: "", location: "", linkedinUrl: "", contactEmail: "", note: "", gradTerm: "Winter 2025", major: "" };
const directory = (extra: Partial<AlumniDirectory> = {}): AlumniDirectory => ({ canRemoveOthers: false, mine: null, defaults: { gradTerm: "Winter 2027", major: "IOE" }, entries: [alex, morgan], ...extra });

async function load(t: test.TestContext) {
  t.mock.module("next/navigation", { namedExports: { useRouter: () => ({ refresh() {} }) } });
  return import(`./alumni-directory.tsx?${Math.random()}`);
}
const render = (Component: unknown, value: AlumniDirectory | null) => renderToStaticMarkup(createElement(Component as never, { directory: value }));

test("an unavailable directory shows an alert and no form", async (t) => {
  const { AlumniDirectory } = await load(t);
  const html = render(AlumniDirectory, null);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /<form/);
});

test("someone not listed gets an open form prefilled from their profile, and no opt-out", async (t) => {
  const { AlumniDirectory } = await load(t);
  const html = render(AlumniDirectory, directory());
  assert.match(html, /You aren’t listed/);
  assert.match(html, /<details class="rounded-xl bg-paper p-4" open="">/);
  assert.match(html, /name="gradTerm"[^>]*value="Winter 2027"/);
  assert.match(html, /name="employer"[^>]*value=""/);
  assert.match(html, /List me in the directory/);
  assert.match(html, /filled in from your profile; clear them/, "prefilled fields are called out");
  assert.doesNotMatch(html, /Take me off/);
  assert.doesNotMatch(html, /Remove on their request/, "members cannot remove others");
  assert.equal((html.match(/<form/g) ?? []).length, 1);
  assert.equal((html.match(/tabindex="-1" role="status"/gi) ?? []).length, 1, "one page-level notice");
});

test("listed members see what they share, can edit and can opt out", async (t) => {
  const { AlumniDirectory } = await load(t);
  const mine = { ...morgan, isMine: true, employer: "", jobTitle: "", contactEmail: "" };
  const html = render(AlumniDirectory, directory({ mine, entries: [alex, mine] }));
  assert.match(html, /You are listed\. Members and the board see your name and your graduation term, major, city, LinkedIn link, note\./);
  assert.match(html, /name="employer"[^>]*value=""/);
  assert.match(html, /Save listing/);
  assert.doesNotMatch(html, /filled in from your profile/);
  assert.match(html, /Take me off the directory/);
  assert.match(html, /Morgan Member<span[^>]*> · you<\/span>/);
});

test("entries show only shared details, safe links and name order from the server", async (t) => {
  const { AlumniDirectory } = await load(t);
  const html = render(AlumniDirectory, directory());
  assert.ok(html.indexOf(">Alex Alum<") < html.indexOf(">Morgan Member<"));
  assert.match(html, /Analyst, Ford/);
  assert.match(html, /href="https:\/\/www.linkedin.com\/in\/morgan" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /href="mailto:morgan@example.invalid"/);
  const nameless = render(AlumniDirectory, directory({ entries: [{ ...morgan, name: null }] }));
  assert.match(nameless, /profile of Name not set/);
  assert.equal((html.match(/LinkedIn<span/g) ?? []).length, 1, "Alex shared no link");
  assert.match(html, /2 listed/);
  assert.match(html, /never public/);
});

test("the board can remove someone else's listing but sees no remove on its own", async (t) => {
  const { AlumniDirectory } = await load(t);
  const mine = { ...alex, isMine: true };
  const html = render(AlumniDirectory, directory({ canRemoveOthers: true, mine, entries: [mine, morgan] }));
  assert.equal((html.match(/Remove on their request/g) ?? []).length, 1);
  assert.equal((html.match(/<summary class="flex min-h-11/g) ?? []).length, 2, "disclosures meet the 44px target");
});

test("an empty directory explains how people appear", async (t) => {
  const { AlumniDirectory } = await load(t);
  const html = render(AlumniDirectory, directory({ entries: [] }));
  assert.match(html, /Nobody is listed yet/);
  assert.doesNotMatch(html, /type="search"/);
});
