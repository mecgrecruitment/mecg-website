import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
type LoadHook = (url: string, context: unknown, nextLoad: (url: string, context: unknown) => LoadResult) => LoadResult;
// registerHooks is newer than the installed @types/node.
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { load: LoadHook }) => void };

// node --test only strips types, it cannot compile JSX, so the component is
// transpiled with the TypeScript already in devDependencies before import.
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith(".tsx")) return nextLoad(url, context);
    const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    });
    return { format: "module", shortCircuit: true, source: outputText };
  },
});

const { default: ApplicationCountdown } = await import("./application-countdown.tsx");
const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime.js");

// The component calls useRouter() to refresh the server render when the window
// opens, and next/navigation throws unless the app router context is mounted.
// Next mounts it for real SSR; a bare renderToStaticMarkup has to supply it.
// refresh is a no-op here because effects never run during a server render.
function serverMarkup(opensAt: string) {
  return renderToStaticMarkup(createElement(
    AppRouterContext.Provider,
    { value: { refresh() {} } as never },
    createElement(ApplicationCountdown, { opensAt }),
  ));
}

test("the server render before opens_at never claims applications are open", () => {
  const markup = serverMarkup(new Date(Date.now() + 86_400_000).toISOString());
  assert.doesNotMatch(markup, /open now/i);
  assert.match(markup, /Applications open in/);
});

test("the server render holds placeholder digits until the client clock arrives", () => {
  const markup = serverMarkup(new Date(Date.now() + 86_400_000).toISOString());
  assert.match(markup, /--/);
  assert.doesNotMatch(markup, /\b00\b/);
});
