import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import * as nodeModule from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
type LoadHook = (url: string, context: unknown, nextLoad: (url: string, context: unknown) => LoadResult) => LoadResult;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { load: LoadHook }) => void };

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

test("configured login renders the Clerk flow with visible provider identity", async (t) => {
  t.mock.module("next/navigation", { namedExports: { redirect: () => { throw new Error("unexpected redirect"); } } });
  t.mock.module("next/image", {
    defaultExport: (props: Record<string, unknown>) => createElement("img", { alt: props.alt }),
  });
  t.mock.module("next/link", {
    defaultExport: ({ children, href }: { children: ReactNode; href: string }) => createElement("a", { href }, children),
  });
  const seen: { appearance?: ClerkAppearance } = {};
  t.mock.module("@clerk/nextjs", {
    namedExports: {
      SignIn: ({ fallback, path, routing, signUpUrl, fallbackRedirectUrl, appearance }: {
        fallback: ReactElement;
        path: string;
        routing: string;
        signUpUrl: string;
        fallbackRedirectUrl: string;
        appearance: ClerkAppearance;
      }) => {
        seen.appearance = appearance;
        return createElement("div", {
          "data-clerk-sign-in": true,
          "data-path": path,
          "data-routing": routing,
          "data-sign-up-url": signUpUrl,
          "data-fallback-redirect-url": fallbackRedirectUrl,
        }, fallback);
      },
    },
  });
  t.mock.module("@/lib/auth", { namedExports: { currentDestination: async () => null } });
  t.mock.module("@/lib/env", { namedExports: { hasClerkRuntimeConfiguration: () => true } });

  const specifier = "./[[...login]]/page.tsx?case=configured-clerk";
  const { default: LoginPage } = await import(specifier) as { default: () => Promise<ReactElement> };
  const markup = renderToStaticMarkup(await LoginPage());

  assert.match(markup, /data-clerk-sign-in="true"/);
  assert.match(markup, /data-path="\/login"/);
  assert.match(markup, /data-routing="path"/);
  assert.match(markup, /data-sign-up-url="\/apply"/);
  assert.match(markup, /Loading secure sign-in/);
  assert.match(markup, /Secure authentication powered by Clerk/);

  // The shell already draws the card, the heading and the Clerk attribution, so the widget ships chromeless.
  const elements = seen.appearance?.elements ?? {};
  assert.equal(elements.header?.display, "none");
  assert.equal(elements.footerItem?.display, "none", "Clerk's own 'Secured by Clerk' tag must stay hidden");
  assert.equal(elements.card?.boxShadow, "none");
  assert.equal(elements.cardBox?.boxShadow, "none");
  assert.equal(seen.appearance?.variables?.colorPrimary, "#fe904d");
  assert.equal(seen.appearance?.variables?.borderRadius, "2px");

  // `appearance` is typed `any`, so a renamed or dropped Clerk element key would fail silently.
  const config = clerkElementsConfig();
  for (const key of Object.keys(elements)) {
    assert.ok(config.has(key), `unknown Clerk appearance element "${key}"`);
  }
});

type ClerkAppearance = {
  variables?: Record<string, string>;
  elements?: Record<string, Record<string, string | number>>;
};

/** Element keys Clerk actually supports, read from the installed `ElementsConfig` type. */
function clerkElementsConfig(): Set<string> {
  const dir = fileURLToPath(new URL("../../../node_modules/@clerk/react/dist/", import.meta.url));
  const keys = new Set<string>();
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".d.mts"))) {
    const source = readFileSync(`${dir}${file}`, "utf8");
    const block = source.match(/type ElementsConfig = \{([\s\S]*?)\n\};/)?.[1];
    if (!block) continue;
    for (const [, key] of block.matchAll(/^\s{2}([A-Za-z0-9_]+):/gm)) keys.add(key!);
  }
  assert.ok(keys.size > 0, "could not read Clerk's ElementsConfig");
  return keys;
}
