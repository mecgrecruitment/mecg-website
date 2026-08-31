// Registered via `node --import ./scripts/test-esm-loader.mjs`.
import { register } from "node:module";
register("./test-esm-hooks.mjs", import.meta.url);
