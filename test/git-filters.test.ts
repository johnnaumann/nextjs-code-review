import { describe, expect, it } from "vitest";

import {
  isGeneratedPath,
  isLikelyTrivialPatch,
  patchAddedBody
} from "../src/core/git.js";

describe("isGeneratedPath", () => {
  it("flags lockfiles", () => {
    expect(isGeneratedPath("yarn.lock")).toBe(true);
    expect(isGeneratedPath("package-lock.json")).toBe(true);
    expect(isGeneratedPath("pnpm-lock.yaml")).toBe(true);
  });

  it("flags generator output and build dirs", () => {
    expect(isGeneratedPath("src/gen/grid-user/api.ts")).toBe(true);
    expect(isGeneratedPath("dist/cli.js")).toBe(true);
    expect(isGeneratedPath(".next/server/app/page.js")).toBe(true);
    expect(isGeneratedPath("src/__generated__/types.ts")).toBe(true);
  });

  it("flags binary and minified files", () => {
    expect(isGeneratedPath("public/logo.png")).toBe(true);
    expect(isGeneratedPath("static/vendor.min.js")).toBe(true);
    expect(isGeneratedPath("fonts/Inter.woff2")).toBe(true);
  });

  it("does not flag normal source files", () => {
    expect(isGeneratedPath("src/app/page.tsx")).toBe(false);
    expect(isGeneratedPath("lib/utils/cn.ts")).toBe(false);
  });
});

describe("patchAddedBody", () => {
  it("extracts only added lines, ignoring +++ headers", () => {
    const patch = [
      "diff --git a/x.ts b/x.ts",
      "--- a/x.ts",
      "+++ b/x.ts",
      "@@ -1,2 +1,3 @@",
      " unchanged",
      "-removed",
      "+added one",
      "+added two"
    ].join("\n");
    expect(patchAddedBody(patch)).toBe("added one\nadded two");
  });
});

describe("isLikelyTrivialPatch", () => {
  it("treats a whitespace-only addition as trivial", () => {
    const patch = [
      "diff --git a/x.ts b/x.ts",
      "--- a/x.ts",
      "+++ b/x.ts",
      "@@ -0,0 +1,2 @@",
      "+",
      "+   "
    ].join("\n");
    expect(isLikelyTrivialPatch(patch)).toBe(true);
  });

  it("treats a near-empty new file as trivial", () => {
    const patch = [
      "diff --git a/_components/index.ts b/_components/index.ts",
      "new file mode 100644",
      "index 0000000..e69de29",
      "--- /dev/null",
      "+++ b/_components/index.ts",
      "@@ -0,0 +1 @@",
      "+"
    ].join("\n");
    expect(isLikelyTrivialPatch(patch)).toBe(true);
  });

  it("does not treat a real addition as trivial", () => {
    const patch = [
      "diff --git a/x.ts b/x.ts",
      "--- a/x.ts",
      "+++ b/x.ts",
      "@@ -0,0 +1,3 @@",
      "+export function add(a: number, b: number) {",
      "+  return a + b;",
      "+}"
    ].join("\n");
    expect(isLikelyTrivialPatch(patch)).toBe(false);
  });
});
