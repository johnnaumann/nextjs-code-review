import { readFileSync } from "node:fs";

import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

const versionDefine = {
  __PKG_VERSION__: JSON.stringify(pkg.version)
};

export default defineConfig([
  // Library entry — ESM only, no bundling of runtime deps.
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
    target: "node18",
    sourcemap: true,
    define: versionDefine
  },
  // CLI entry — CJS only, with all runtime deps inlined so the binary is
  // immune to hoisting collisions in consumer node_modules trees (e.g. an
  // old `commander` hoisted by another package).
  {
    entry: { cli: "src/cli.ts" },
    format: ["cjs"],
    dts: false,
    clean: false,
    target: "node18",
    sourcemap: true,
    noExternal: ["chalk", "commander", "gray-matter", "ora", "simple-git", "zod"],
    define: versionDefine,
    banner: {
      js: "#!/usr/bin/env node"
    }
  }
]);
