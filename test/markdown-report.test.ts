import { describe, expect, it } from "vitest";

import { buildMarkdownReport } from "../src/core/report/markdown.js";

describe("buildMarkdownReport", () => {
  it("emits an in-progress header when inProgress=true and shows progress count", () => {
    const md = buildMarkdownReport({
      branch: "develop",
      model: "qwen2.5-coder:14b",
      skillsLock: null,
      resultsByFile: [
        {
          file: "src/a.ts",
          result: { summary: "s", findings: [] }
        }
      ],
      totalFiles: 5,
      inProgress: true
    });
    expect(md).toContain("# Code review report (in progress)");
    expect(md).toContain("**progress**: 1 / 5 file(s) reviewed");
    expect(md).toContain("### src/a.ts");
  });

  it("emits a friendly placeholder when no files are reviewed yet", () => {
    const md = buildMarkdownReport({
      branch: "develop",
      model: "qwen2.5-coder:14b",
      skillsLock: null,
      resultsByFile: [],
      totalFiles: 12,
      inProgress: true
    });
    expect(md).toContain("_No files reviewed yet._");
    expect(md).toContain("**progress**: 0 / 12 file(s) reviewed");
  });

  it("renders findings with severity, skill, ruleId, and suggestion", () => {
    const md = buildMarkdownReport({
      branch: "feat",
      model: "qwen2.5-coder:14b",
      skillsLock: null,
      resultsByFile: [
        {
          file: "src/a.tsx",
          result: {
            summary: "looks ok",
            findings: [
              {
                file: "src/a.tsx",
                line: 12,
                severity: "warning",
                skill: "react-best-practices",
                ruleId: "rerender-memo",
                message: "Wrap in memo",
                suggestion: "use React.memo"
              }
            ]
          }
        }
      ],
      inProgress: false
    });
    expect(md).toContain("**WARNING**");
    expect(md).toContain("react-best-practices");
    expect(md).toContain("(rerender-memo)");
    expect(md).toContain("src/a.tsx:12");
    expect(md).toContain("Suggestion: use React.memo");
  });
});
