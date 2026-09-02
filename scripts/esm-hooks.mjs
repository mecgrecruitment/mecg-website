import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Plain `node --test` has no bundler, so it can't resolve two things this
// repo's app code relies on webpack/turbopack for: Next's extensionless
// "next/server" subpath export, and the "@/*" -> "./src/*" tsconfig path
// alias. This resolve hook teaches Node's own ESM loader both mappings so
// route handlers can be imported (and t.mock.module'd) directly in tests.
export async function resolve(specifier, context, nextResolve) {
  // Next ships extensionless subpaths ("next/server", "next/image", ...) that
  // only a bundler resolves; fall back to the ".js" file Node can find.
  if (specifier.startsWith("next/") && !specifier.endsWith(".js")) {
    try {
      return await nextResolve(specifier, context);
    } catch {
      return nextResolve(`${specifier}.js`, context);
    }
  }
  // Components are ".tsx"; everything else in src is ".ts". TypeScript lets both
  // be imported without an extension, which Node's resolver will not do.
  if (specifier.startsWith("@/")) {
    return nextResolve(sourceFile(new URL(`../src/${specifier.slice(2)}`, import.meta.url)), context);
  }
  const srcRoot = new URL("../src/", import.meta.url).href;
  if (/^\.\.?\//.test(specifier) && !/\.[a-z]+$/.test(specifier) && context.parentURL?.startsWith(srcRoot)) {
    return nextResolve(sourceFile(new URL(specifier, context.parentURL)), context);
  }
  return nextResolve(specifier, context);
}

function sourceFile(base) {
  const tsx = new URL(`${base.href}.tsx`);
  return existsSync(fileURLToPath(tsx)) ? tsx.href : `${base.href}.ts`;
}
