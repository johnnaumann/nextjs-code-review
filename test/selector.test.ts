import { describe, expect, it } from "vitest";

import type { LoadedSkill } from "../src/core/skills/loader.js";
import { selectRulesForFile } from "../src/core/skills/selector.js";

const reactBestPractices: LoadedSkill = {
  name: "react-best-practices",
  description: "React perf",
  skillBody: "...",
  rules: [
    {
      path: "rules/rerender-memo.md",
      title: "Use memo",
      impact: "MEDIUM",
      tags: ["rerender", "memo", "optimization"],
      body: "..."
    },
    {
      path: "rules/rerender-derived-state-no-effect.md",
      title: "Derived state without useEffect",
      impact: "HIGH",
      tags: ["rerender", "derived-state", "useeffect", "state"],
      body: "..."
    },
    {
      path: "rules/server-no-shared-module-state.md",
      title: "No shared module state",
      impact: "HIGH",
      tags: ["server", "rsc", "ssr", "concurrency", "security", "state"],
      body: "..."
    },
    {
      path: "rules/js-batch-dom-css.md",
      title: "Batch DOM/CSS work",
      impact: "MEDIUM",
      tags: ["javascript", "dom", "css", "performance", "reflow"],
      body: "..."
    }
  ]
};

const compositionPatterns: LoadedSkill = {
  name: "composition-patterns",
  description: "Composition",
  skillBody: "...",
  rules: [
    {
      path: "rules/state-context-interface.md",
      title: "Generic context interfaces",
      impact: "HIGH",
      tags: ["composition", "context", "state", "typescript", "dependency-injection"],
      body: "..."
    }
  ]
};

const webDesign: LoadedSkill = {
  name: "web-design-guidelines",
  description: "UI guidelines",
  skillBody: "...",
  rules: [] // SKILL.md only
};

const allSkills: LoadedSkill[] = [reactBestPractices, compositionPatterns, webDesign];

describe("selectRulesForFile", () => {
  it("drops React skills for non-JS files but keeps the SKILL.md-only skill", () => {
    const out = selectRulesForFile(allSkills, {
      filePath: "styles/global.css",
      diff: "+ .x { color: red; }"
    });
    const names = out.map((o) => o.skill.name);
    expect(names).not.toContain("react-best-practices");
    expect(names).not.toContain("composition-patterns");
    expect(names).toContain("web-design-guidelines");
  });

  it("matches useEffect-related rules in a tsx diff", () => {
    const diff = [
      "+import { useEffect, useState } from 'react'",
      "+function Demo() {",
      "+  const [n, setN] = useState(0)",
      "+  useEffect(() => { setN(n + 1) }, [n])",
      "+  return null",
      "+}"
    ].join("\n");
    const out = selectRulesForFile(allSkills, {
      filePath: "app/components/Demo.tsx",
      diff
    });
    const reactBucket = out.find((o) => o.skill.name === "react-best-practices");
    expect(reactBucket).toBeDefined();
    const titles = reactBucket?.rules.map((r) => r.title) ?? [];
    expect(titles).toContain("Derived state without useEffect");
  });

  it("respects maxRules cap", () => {
    const out = selectRulesForFile(
      allSkills,
      {
        filePath: "app/page.tsx",
        diff: "+useEffect(() => {}); +useMemo(() => {}); +useCallback(() => {});"
      },
      { maxRules: 1 }
    );
    const totalRules = out.reduce((acc, o) => acc + o.rules.length, 0);
    expect(totalRules).toBeLessThanOrEqual(1);
  });

  it("falls back to high-impact rules when nothing matches by tags", () => {
    const out = selectRulesForFile(allSkills, {
      filePath: "src/utils/format.ts",
      diff: "+export const x = 1;"
    });
    // For .ts files, react-best-practices is still applicable.
    const reactBucket = out.find((o) => o.skill.name === "react-best-practices");
    expect(reactBucket).toBeDefined();
    expect(reactBucket?.rules.length).toBeGreaterThan(0);
  });
});
