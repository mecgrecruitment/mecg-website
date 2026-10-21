import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
type LoadHook = (url: string, context: unknown, nextLoad: (url: string, context: unknown) => LoadResult) => LoadResult;
// registerHooks is newer than the installed @types/node.
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { load: LoadHook }) => void };

// Client components that would only drag Clerk and browser internals into the
// render. This load hook runs ahead of the test runner's module mocks, so
// stubbing them here is what keeps them out of the tree.
const STUBBED = ["/components/logout-button.tsx", "/apply/application-form.tsx", "/apply/applicant-signup-form.tsx"];

// Same trick as src/components/application-countdown.test.ts: node --test only
// strips types, so JSX is transpiled with the TypeScript already in
// devDependencies. ".tsx" resolution of "@/*" lives in scripts/esm-hooks.mjs,
// which the mock loader also runs through.

registerHooks({
  load(url, context, nextLoad) {
    const path = url.split("?")[0]!;
    if (!path.endsWith(".tsx")) return nextLoad(url, context);
    if (STUBBED.some((stub) => path.endsWith(stub))) {
      return { format: "module", shortCircuit: true, source: "export default function Stub() { return null; }" };
    }
    const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(path), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    });
    return { format: "module", shortCircuit: true, source: outputText };
  },
});

const OPENS_AT = new Date(Date.now() + 15 * 60_000).toISOString();
const CLOSES_AT = new Date(Date.now() + 7 * 86_400_000).toISOString();
const SIGNED_IN_USER = { id: "u1", email: "ada@umich.edu", name: "Ada", active: true, memberships: [] };

async function mockPage(t: TestContext, options: { timelineUnavailable?: boolean; malformedSchema?: boolean } = {}) {
  const recruitment = await import("@/lib/public-recruitment");
  t.mock.module("@/lib/public-recruitment", {
    namedExports: {
      ...recruitment,
      // Only the network call is faked; the window logic under test is real.
      fetchPublicRecruitment: async () => options.timelineUnavailable ? { kind: "unavailable", cycle: null, events: [] } : ({ kind: "available", events: [], cycle: { name: "Fall 2026", status: "OPEN", opensAt: OPENS_AT, closesAt: CLOSES_AT } }),
    },
  });
  t.mock.module("next/navigation", {
    namedExports: {
      redirect: () => { throw new Error("unexpected redirect"); },
      // ApplicationCountdown refreshes the server render when the window opens.
      useRouter: () => ({ refresh() {} }),
    },
  });
  t.mock.module("next/image", { defaultExport: () => null });
  t.mock.module("@/lib/auth", {
    namedExports: { currentDestination: async () => "/apply", currentUser: async () => SIGNED_IN_USER },
  });
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      // intake_schema reports open:false for the entire window before opens_at.
      createClient: async () => ({
        rpc: async (name: string) => (name === "intake_schema"
          ? { data: { ...(options.malformedSchema ? {} : { open: false }), cycleName: "Fall 2026", questions: [] }, error: null }
          : { data: false, error: null }),
      }),
    },
  });
}

// A student who created an account at 19:45 used to land on a red "Applications
// closed" badge over an empty form, with no countdown, fifteen minutes before
// the portal opened.
test("a signed-in applicant before opens_at sees the countdown, not a closed badge", async (t) => {
  await mockPage(t);
  // A variable specifier keeps the cache-busting query out of tsc's resolver,
  // the same way the route tests do it.
  const specifier = "./page.tsx?case=pre-open";
  const { default: ApplyPage } = await import(specifier) as { default: () => Promise<ReactElement> };
  const markup = renderToStaticMarkup(await ApplyPage());
  assert.doesNotMatch(markup, /Applications closed/);
  assert.match(markup, /Applications open in/);
  assert.match(markup, /Applications open at \d{1,2}:\d{2}\s?(AM|PM)/);
});


test("a signed-in applicant with unavailable opening dates is not told the deadline passed", async (t) => {
  await mockPage(t, { timelineUnavailable: true });
  const specifier = "./page.tsx?case=timeline-unavailable";
  const { default: ApplyPage } = await import(specifier) as { default: () => Promise<ReactElement> };
  const markup = renderToStaticMarkup(await ApplyPage());
  assert.doesNotMatch(markup, /Applications closed|Applications are currently closed/);
  assert.match(markup, /Not accepting submissions/);
  assert.match(markup, /could not load the opening timeline/);
  assert.match(markup, /browser recovery copy has not been removed/);
});

test("an intake schema missing its open flag is unavailable rather than closed", async (t) => {
  await mockPage(t, { malformedSchema: true });
  const specifier = "./page.tsx?case=malformed-open-flag";
  const { default: ApplyPage } = await import(specifier) as { default: () => Promise<ReactElement> };
  const markup = renderToStaticMarkup(await ApplyPage());
  assert.match(markup, /The application could not be loaded/);
  assert.doesNotMatch(markup, /Applications closed|Applications are currently closed/);
});
