// Plain `node --test` has no bundler, so it can't resolve two things this
// repo's app code relies on webpack/turbopack for: Next's extensionless
// "next/server" subpath export, and the "@/*" -> "./src/*" tsconfig path
// alias. This resolve hook teaches Node's own ESM loader both mappings so
// route handlers can be imported (and t.mock.module'd) directly in tests.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  if (specifier.startsWith("@/")) {
    return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  }
  return nextResolve(specifier, context);
}
