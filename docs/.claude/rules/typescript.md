<!-- HOW RULES WORK: every .md in .claude/rules/ is auto-discovered. With a `paths:`
     frontmatter it loads ONLY when Claude touches a matching file (cheap, lazy). Without
     `paths:` it loads at every startup — so keep any unconditional rule tiny, or none.
     This example is scoped to TypeScript; edit or delete it. -->
---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# TypeScript conventions (example — edit or delete)

- No `any`; prefer `unknown` + narrowing.
- Type-only imports: `import type { X } from "..."`.
- Errors: throw `Error` subclasses or return typed results — never bare strings.
