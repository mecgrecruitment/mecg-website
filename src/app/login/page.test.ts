import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  t.mock.module("@clerk/nextjs", {
    namedExports: {
      SignIn: ({ fallback, routing, signUpUrl, fallbackRedirectUrl }: {
        fallback: ReactElement;
        routing: string;
        signUpUrl: string;
        fallbackRedirectUrl: string;
      }) => createElement("div", {
        "data-clerk-sign-in": true,
        "data-routing": routing,
        "data-sign-up-url": signUpUrl,
        "data-fallback-redirect-url": fallbackRedirectUrl,
      }, fallback),
    },
  });
  t.mock.module("@/lib/auth", { namedExports: { currentDestination: async () => null } });
  t.mock.module("@/lib/env", { namedExports: { hasClerkRuntimeConfiguration: () => true } });

  const specifier = "./page.tsx?case=configured-clerk";
  const { default: LoginPage } = await import(specifier) as { default: () => Promise<ReactElement> };
  const markup = renderToStaticMarkup(await LoginPage());

  assert.match(markup, /data-clerk-sign-in="true"/);
  assert.match(markup, /data-routing="hash"/);
  assert.match(markup, /data-sign-up-url="\/apply"/);
  assert.match(markup, /Loading secure sign-in/);
  assert.match(markup, /Secure authentication powered by Clerk/);
});
