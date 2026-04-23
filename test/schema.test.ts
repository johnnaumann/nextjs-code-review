import { describe, expect, it } from "vitest";

import { reviewResultSchema } from "../src/core/prompt/schema.js";

describe("reviewResultSchema", () => {
  it("accepts a valid result", () => {
    const parsed = reviewResultSchema.parse({
      summary: "ok",
      findings: [
        {
          file: "src/a.ts",
          severity: "warning",
          skill: "react-best-practices",
          ruleId: "bundle-barrel-imports",
          message: "Avoid barrel imports",
          suggestion: "Import from the module directly"
        }
      ]
    });

    expect(parsed.findings).toHaveLength(1);
  });

  it("rejects invalid severity", () => {
    expect(() =>
      reviewResultSchema.parse({
        summary: "x",
        findings: [{ file: "a", severity: "bad", skill: "s", message: "m" }]
      })
    ).toThrow();
  });
});

